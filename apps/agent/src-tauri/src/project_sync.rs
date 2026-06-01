use anyhow::Result;
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{agent_config::AgentSettings, project_registry::ProjectEntry};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProject {
    pub agent_key: String,
    pub display_name: String,
    pub path_alias: String,
    pub available: bool,
}

#[derive(Debug)]
pub struct ProjectSyncRequest {
    pub url: Url,
    pub device_token: String,
    pub body: String,
}

pub struct ProjectSyncHttpClient;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBindRequestInput {
    pub server_url: String,
    pub bind_code: String,
    pub name: String,
    pub platform: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBindResponse {
    pub device_id: String,
    pub token: String,
}

#[derive(Debug)]
pub struct DeviceBindRequest {
    pub url: Url,
    pub body: String,
}

pub struct DeviceBindHttpClient;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSyncBody {
    device_id: String,
    projects: Vec<SyncProject>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceBindBody {
    bind_code: String,
    name: String,
    platform: String,
}

pub fn build_project_sync_request(
    base_url: &str,
    device_id: &str,
    device_token: &str,
    projects: Vec<SyncProject>,
) -> Result<ProjectSyncRequest> {
    let mut url = Url::parse(base_url)?;
    url.set_path("/agent/projects/sync");
    url.set_query(None);
    let body = serde_json::to_string(&ProjectSyncBody {
        device_id: device_id.to_string(),
        projects,
    })?;

    Ok(ProjectSyncRequest {
        url,
        device_token: device_token.to_string(),
        body,
    })
}

pub fn sync_projects_from_registry(
    settings: &AgentSettings,
    projects: Vec<ProjectEntry>,
) -> Result<ProjectSyncRequest> {
    let sync_projects = projects
        .into_iter()
        .map(|project| SyncProject {
            agent_key: project.project_id.to_string(),
            display_name: project.display_name,
            path_alias: project.path_alias,
            available: project.available,
        })
        .collect();

    build_project_sync_request(
        &settings.server_url,
        &settings.device_id,
        &settings.device_token,
        sync_projects,
    )
}

impl ProjectSyncHttpClient {
    pub fn headers(request: &ProjectSyncRequest) -> Vec<(String, String)> {
        vec![
            ("content-type".to_string(), "application/json".to_string()),
            ("x-device-token".to_string(), request.device_token.clone()),
        ]
    }

    pub async fn send(request: ProjectSyncRequest) -> Result<()> {
        let client = reqwest::Client::new();
        let response = client
            .post(request.url)
            .header("content-type", "application/json")
            .header("x-device-token", request.device_token)
            .body(request.body)
            .send()
            .await?;
        response.error_for_status()?;
        Ok(())
    }
}

pub fn build_device_bind_request(
    base_url: &str,
    bind_code: &str,
    name: &str,
    platform: &str,
) -> Result<DeviceBindRequest> {
    let mut url = Url::parse(base_url)?;
    url.set_path("/agent/bind");
    url.set_query(None);
    let body = serde_json::to_string(&DeviceBindBody {
        bind_code: bind_code.to_string(),
        name: name.to_string(),
        platform: platform.to_string(),
    })?;
    Ok(DeviceBindRequest { url, body })
}

impl DeviceBindHttpClient {
    pub fn headers() -> Vec<(String, String)> {
        vec![("content-type".to_string(), "application/json".to_string())]
    }

    pub async fn send(request: DeviceBindRequest) -> Result<DeviceBindResponse> {
        let client = reqwest::Client::new();
        let response = client
            .post(request.url)
            .header("content-type", "application/json")
            .body(request.body)
            .send()
            .await?
            .error_for_status()?
            .json::<DeviceBindResponse>()
            .await?;
        Ok(response)
    }
}
