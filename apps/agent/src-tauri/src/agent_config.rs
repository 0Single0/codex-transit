use std::{fs, path::Path};

use anyhow::Result;
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

    pub fn load_from_file(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let settings = serde_json::from_str(&fs::read_to_string(path)?)?;
        Ok(Self {
            settings: Some(settings),
        })
    }

    pub fn save_to_file(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        if let Some(settings) = &self.settings {
            fs::write(path, serde_json::to_string_pretty(settings)?)?;
        }
        Ok(())
    }
}
