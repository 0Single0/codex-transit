use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RealtimeEvent {
    #[serde(rename = "session.start", rename_all = "camelCase")]
    SessionStart {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        #[serde(skip_serializing_if = "Option::is_none")]
        codex_session_id: Option<String>
    },
    #[serde(rename = "session.input", rename_all = "camelCase")]
    SessionInput {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        #[serde(skip_serializing_if = "Option::is_none")]
        codex_session_id: Option<String>,
        text: String
    },
    #[serde(rename = "session.stop", rename_all = "camelCase")]
    SessionStop {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        #[serde(skip_serializing_if = "Option::is_none")]
        codex_session_id: Option<String>
    },
    #[serde(rename = "codex.history.request", rename_all = "camelCase")]
    CodexHistoryRequest {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        #[serde(skip_serializing_if = "Option::is_none")]
        project_id: Option<Uuid>,
        limit: u32
    },
    #[serde(rename = "codex.history.detail.request", rename_all = "camelCase")]
    CodexHistoryDetailRequest {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        codex_session_id: String
    },
    #[serde(rename = "codex.history.result", rename_all = "camelCase")]
    CodexHistoryResult {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        ok: bool,
        sessions: Vec<CodexHistoryItem>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>
    },
    #[serde(rename = "codex.history.detail.result", rename_all = "camelCase")]
    CodexHistoryDetailResult {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        codex_session_id: String,
        ok: bool,
        messages: Vec<CodexHistoryMessage>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>
    },
    #[serde(rename = "diff.request", rename_all = "camelCase")]
    DiffRequest {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        relative_path: String
    },
    #[serde(rename = "codex.output.chunk", rename_all = "camelCase")]
    CodexOutputChunk {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        seq: u64,
        stream: String,
        text: String
    },
    #[serde(rename = "file.changed", rename_all = "camelCase")]
    FileChanged {
        event_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        relative_path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        old_relative_path: Option<String>,
        change_type: String
    },
    #[serde(rename = "diff.result", rename_all = "camelCase")]
    DiffResult {
        event_id: Uuid,
        request_id: Uuid,
        timestamp: String,
        user_id: Uuid,
        device_id: Uuid,
        project_id: Uuid,
        session_id: Uuid,
        relative_path: String,
        ok: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        diff: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexHistoryItem {
    pub codex_session_id: String,
    pub title: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexHistoryMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}
