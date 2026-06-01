use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSettings {
    pub server_url: String,
    pub device_id: String,
    pub device_token: String,
}

#[derive(Default)]
pub struct AgentConfig {
    settings: Option<AgentSettings>,
}

impl AgentConfig {
    pub fn update(&mut self, settings: AgentSettings) {
        self.settings = Some(settings);
    }

    pub fn get(&self) -> Option<AgentSettings> {
        self.settings.clone()
    }
}
