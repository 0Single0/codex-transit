use anyhow::Result;

use crate::{protocol::RealtimeEvent, session_manager::SessionManager};

pub fn dispatch_event(manager: &mut SessionManager, event: RealtimeEvent) -> Result<()> {
    manager.handle_event(event)
}
