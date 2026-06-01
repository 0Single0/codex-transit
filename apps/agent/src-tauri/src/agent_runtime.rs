use anyhow::Result;
use tokio::sync::mpsc;

use crate::{
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
