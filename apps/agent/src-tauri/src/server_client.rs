use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

use crate::{agent_config::AgentSettings, protocol::RealtimeEvent};

pub fn agent_realtime_url(base_url: &str, device_id: &str, token: &str) -> Result<Url> {
    let mut url = Url::parse(base_url)?;
    url.set_scheme(match url.scheme() {
        "https" => "wss",
        _ => "ws",
    })
    .map_err(|_| anyhow::anyhow!("invalid realtime url scheme"))?;
    url.set_path("/realtime");
    url.query_pairs_mut()
        .append_pair("role", "agent")
        .append_pair("token", token)
        .append_pair("deviceId", device_id);
    Ok(url)
}

pub struct ServerClient {
    url: String,
}

pub struct AgentRealtimeConfig {
    pub url: Url,
    pub device_id: String,
}

impl AgentRealtimeConfig {
    pub fn from_settings(settings: &AgentSettings) -> Result<Self> {
        Ok(Self {
            url: agent_realtime_url(
                &settings.server_url,
                &settings.device_id,
                &settings.device_token,
            )?,
            device_id: settings.device_id.clone(),
        })
    }
}

impl ServerClient {
    pub fn new(url: impl Into<String>) -> Self {
        Self { url: url.into() }
    }

    pub async fn connect(
        &self,
        outbound_rx: mpsc::Receiver<RealtimeEvent>,
        inbound_tx: mpsc::Sender<RealtimeEvent>,
    ) -> Result<()> {
        let (socket, _) = connect_async(&self.url).await?;
        let (mut write, mut read) = socket.split();
        let mut outbound_rx = outbound_rx;

        let writer = tokio::spawn(async move {
            while let Some(event) = outbound_rx.recv().await {
                let payload = serde_json::to_string(&event)?;
                write.send(Message::Text(payload.into())).await?;
            }
            anyhow::Ok(())
        });

        let reader = tokio::spawn(async move {
            while let Some(message) = read.next().await {
                let message = message?;
                if message.is_text() {
                    let event: RealtimeEvent = serde_json::from_str(message.to_text()?)?;
                    inbound_tx.send(event).await?;
                }
            }
            anyhow::Ok(())
        });

        let _ = tokio::try_join!(writer, reader)?;
        Ok(())
    }
}
