use anyhow::Result;

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
