use std::collections::HashMap;

use anyhow::{bail, Result};
use uuid::Uuid;

use crate::protocol::RealtimeEvent;

#[derive(Default)]
pub struct SessionManager {
    inputs: HashMap<Uuid, Vec<String>>
}

impl SessionManager {
    pub fn handle_event(&mut self, event: RealtimeEvent) -> Result<()> {
        match event {
            RealtimeEvent::SessionStart { session_id, .. } => {
                self.start_recording_session(session_id);
                Ok(())
            }
            RealtimeEvent::SessionInput { session_id, text, .. } => self.send_input(session_id, text),
            RealtimeEvent::SessionStop { session_id, .. } => {
                self.stop_session(session_id);
                Ok(())
            }
            RealtimeEvent::DiffRequest { .. }
            | RealtimeEvent::CodexOutputChunk { .. }
            | RealtimeEvent::FileChanged { .. }
            | RealtimeEvent::DiffResult { .. } => Ok(())
        }
    }

    pub fn start_recording_session(&mut self, session_id: Uuid) {
        self.inputs.entry(session_id).or_default();
    }

    pub fn send_input(&mut self, session_id: Uuid, text: String) -> Result<()> {
        let Some(inputs) = self.inputs.get_mut(&session_id) else {
            bail!("session is not running");
        };
        inputs.push(text);
        Ok(())
    }

    pub fn recorded_inputs(&self, session_id: Uuid) -> Vec<String> {
        self.inputs.get(&session_id).cloned().unwrap_or_default()
    }

    pub fn stop_session(&mut self, session_id: Uuid) {
        self.inputs.remove(&session_id);
    }
}
