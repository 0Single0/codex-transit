pub mod agent_config;
pub mod agent_runtime;
pub mod attachment_store;
pub mod codex_adapter;
pub mod codex_history;
pub mod commands;
pub mod diff_provider;
pub mod file_watcher;
pub mod path_utils;
pub mod path_guard;
pub mod project_registry;
pub mod project_sync;
pub mod protocol;
pub mod provider_models;
pub mod server_client;
pub mod session_manager;

use commands::{
    add_project, bind_device, choose_project_directory, clear_agent_settings,
    get_agent_runtime_status, get_agent_settings, get_device_overview, list_projects, remove_project, save_agent_settings, start_agent_runtime,
    stop_agent_runtime, sync_projects_now, AgentState,
};
use tauri::{
    image::Image,
    Emitter, LogicalSize, PhysicalPosition, Position, Size, WebviewWindow,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

const TRAY_WINDOW_WIDTH: f64 = 318.0;
const TRAY_WINDOW_HEIGHT: f64 = 354.0;

pub fn run() {
    tauri::Builder::default()
        .manage(AgentState::default())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or_else(|| anyhow::anyhow!("main window not found"))?;
            hide_on_close(&window);
            if let Some(tray_window) = app.get_webview_window("tray-popover") {
                hide_on_close(&tray_window);
                hide_on_blur(&tray_window);
            }

            let icon = app
                .default_window_icon()
                .cloned()
                .map(Ok)
                .unwrap_or_else(|| Image::from_bytes(include_bytes!("../icons/icon.ico")))?;

            TrayIconBuilder::new()
                .tooltip("Codex Agent")
                .icon(icon)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => show_main_window(tray.app_handle()),
                        TrayIconEvent::Click {
                            position,
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            ..
                        } => show_tray_window(tray.app_handle(), position),
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_project,
            remove_project,
            choose_project_directory,
            list_projects,
            get_device_overview,
            save_agent_settings,
            get_agent_settings,
            clear_agent_settings,
            sync_projects_now,
            start_agent_runtime,
            stop_agent_runtime,
            get_agent_runtime_status,
            bind_device,
            exit_app,
            open_main_window,
            open_settings_window,
            hide_tray_popover
        ])
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("failed to run Codex Transit Agent");
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(tray_window) = app.get_webview_window("tray-popover") {
        let _ = tray_window.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = app.emit("agent://show-main", ());
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn show_tray_window(app: &tauri::AppHandle, position: PhysicalPosition<f64>) {
    if let Some(window) = app.get_webview_window("tray-popover") {
        let anchor = app.cursor_position().unwrap_or(position);
        let (x, y) = tray_popover_position(app, anchor);
        let _ = app.emit("agent://show-tray-menu", ());
        let _ = window.set_size(Size::Logical(LogicalSize::new(
            TRAY_WINDOW_WIDTH,
            TRAY_WINDOW_HEIGHT,
        )));
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_main_window(app: tauri::AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle, section: String) {
    if let Some(tray_window) = app.get_webview_window("tray-popover") {
        let _ = tray_window.hide();
    }
    let _ = app.emit("agent://show-settings", section);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn hide_tray_popover(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("tray-popover") {
        let _ = window.hide();
    }
}

fn hide_on_close(window: &WebviewWindow) {
    let close_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = close_window.hide();
        }
    });
}

fn hide_on_blur(window: &WebviewWindow) {
    let blur_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let _ = blur_window.hide();
        }
    });
}

fn tray_popover_position(app: &tauri::AppHandle, anchor: PhysicalPosition<f64>) -> (i32, i32) {
    let margin = 10.0;
    let anchor_gap = 12.0;

    let monitor = app
        .monitor_from_point(anchor.x, anchor.y)
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let work_area = monitor.work_area();
        let window_width = TRAY_WINDOW_WIDTH * monitor.scale_factor();
        let window_height = TRAY_WINDOW_HEIGHT * monitor.scale_factor();
        let left = work_area.position.x as f64;
        let top = work_area.position.y as f64;
        let right = left + work_area.size.width as f64;
        let bottom = top + work_area.size.height as f64;

        let min_x = left + margin;
        let min_y = top + margin;
        let max_x = right - window_width - margin;
        let max_y = bottom - window_height - margin;

        let near_left_taskbar = anchor.x < left;
        let near_right_taskbar = anchor.x > right;
        let near_top_taskbar = anchor.y < top;
        let near_bottom_taskbar = anchor.y > bottom;

        let x = if near_left_taskbar {
            left + anchor_gap
        } else if near_right_taskbar {
            right - window_width - anchor_gap
        } else {
            anchor.x - window_width + 32.0
        }
        .clamp(min_x, max_x);

        let y = if near_top_taskbar {
            top + anchor_gap
        } else if near_left_taskbar || near_right_taskbar {
            anchor.y - window_height / 2.0
        } else if near_bottom_taskbar {
            bottom - window_height - anchor_gap
        } else if anchor.y - window_height - anchor_gap >= min_y {
            anchor.y - window_height - anchor_gap
        } else {
            anchor.y + anchor_gap
        }
        .clamp(min_y, max_y);

        return (x.round() as i32, y.round() as i32);
    }

    let mut min_x = 0.0;
    let mut min_y = 0.0;
    let mut max_x = f64::MAX;
    let mut max_y = f64::MAX;
    let mut window_width = TRAY_WINDOW_WIDTH;
    let mut window_height = TRAY_WINDOW_HEIGHT;

    if let Ok(Some(monitor)) = app.primary_monitor() {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        window_width = TRAY_WINDOW_WIDTH * monitor.scale_factor();
        window_height = TRAY_WINDOW_HEIGHT * monitor.scale_factor();
        min_x = monitor_position.x as f64 + margin;
        min_y = monitor_position.y as f64 + margin;
        max_x = monitor_position.x as f64 + monitor_size.width as f64 - window_width - margin;
        max_y = monitor_position.y as f64 + monitor_size.height as f64 - window_height - margin;
    }

    let x = (anchor.x - window_width + 32.0).clamp(min_x, max_x);
    let y_above = anchor.y - window_height - margin;
    let y = if y_above >= min_y {
        y_above
    } else {
        (anchor.y + margin).clamp(min_y, max_y)
    };

    (x.round() as i32, y.round() as i32)
}
