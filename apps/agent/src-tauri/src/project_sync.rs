use anyhow::Result;
use serde::Serialize;
use url::Url;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProject {
    pub agent_key: String,
    pub display_name: String,
    pub path_alias: String,
    pub available: bool
}

#[derive(Debug)]
pub struct ProjectSyncRequest {
    pub url: Url,
    pub device_token: String,
    pub body: String
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSyncBody {
    device_id: String,
    projects: Vec<SyncProject>
}

pub fn build_project_sync_request(
    base_url: &str,
    device_id: &str,
    device_token: &str,
    projects: Vec<SyncProject>
) -> Result<ProjectSyncRequest> {
    let mut url = Url::parse(base_url)?;
    url.set_path("/agent/projects/sync");
    url.set_query(None);
    let body = serde_json::to_string(&ProjectSyncBody {
        device_id: device_id.to_string(),
        projects
    })?;

    Ok(ProjectSyncRequest {
        url,
        device_token: device_token.to_string(),
        body
    })
}
