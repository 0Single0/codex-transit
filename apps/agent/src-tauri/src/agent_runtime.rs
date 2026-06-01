use std::path::Path;

use anyhow::Result;
use notify::Event;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    file_watcher::event_to_file_changes,
    protocol::RealtimeEvent,
    session_manager::{SessionManager, SessionProcessRunner},
};

pub async fn dispatch_event<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
    event: RealtimeEvent,
) -> Result<()> {
    manager.handle_event(event).await
}

pub async fn handle_next_inbound_event<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
    inbound_rx: &mut mpsc::Receiver<RealtimeEvent>,
) -> Result<bool> {
    let Some(event) = inbound_rx.recv().await else {
        return Ok(false);
    };
    dispatch_event(manager, event).await?;
    Ok(true)
}

pub async fn forward_next_outbound_event<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
    outbound_tx: &mpsc::Sender<RealtimeEvent>,
) -> Result<bool> {
    let Some(event) = manager.next_outbound_event().await else {
        return Ok(false);
    };
    outbound_tx.send(event).await?;
    Ok(true)
}

pub async fn pump_next_process_output<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
) -> Result<bool> {
    manager.pump_process_output_once().await
}

pub async fn pump_next_file_change<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
    file_event_rx: &mut mpsc::Receiver<Event>,
    project_id: Uuid,
    project_root: &Path,
) -> Result<bool> {
    let Some(event) = file_event_rx.recv().await else {
        return Ok(false);
    };
    for change in event_to_file_changes(project_id, project_root, event) {
        manager.record_file_change(change).await?;
    }
    Ok(true)
}

pub async fn run_agent_once<R: SessionProcessRunner>(
    manager: &mut SessionManager<R>,
    inbound_rx: &mut mpsc::Receiver<RealtimeEvent>,
    outbound_tx: &mpsc::Sender<RealtimeEvent>,
    file_event_rx: &mut mpsc::Receiver<Event>,
    project_id: Uuid,
    project_root: &Path,
) -> Result<bool> {
    if let Some(output) = manager.try_next_process_output() {
        manager.record_process_output(output).await?;
        return Ok(true);
    }
    if let Some(event) = manager.try_next_outbound_event() {
        outbound_tx.send(event).await?;
        return Ok(true);
    }
    if let Ok(event) = inbound_rx.try_recv() {
        dispatch_event(manager, event).await?;
        return Ok(true);
    }
    if let Ok(event) = file_event_rx.try_recv() {
        for change in event_to_file_changes(project_id, project_root, event) {
            manager.record_file_change(change).await?;
        }
        return Ok(true);
    }
    Ok(false)
}
