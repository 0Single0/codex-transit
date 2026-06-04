use anyhow::{bail, Result};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

use crate::{agent_config::AgentSettings, protocol::RealtimeEvent};

pub fn parse_realtime_message(text: &str) -> Result<Option<RealtimeEvent>> {
    let value: serde_json::Value = serde_json::from_str(text)?;
    if value.get("type").and_then(|kind| kind.as_str()) == Some("connected") {
        return Ok(None);
    }
    Ok(Some(serde_json::from_value(value)?))
}

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
        connected_tx: Option<oneshot::Sender<()>>,
    ) -> Result<()> {
        let (socket, _) = connect_async(&self.url).await?;
        let (mut write, mut read) = socket.split();
        let mut outbound_rx = outbound_rx;

        let mut writer = tokio::spawn(async move {
            while let Some(event) = outbound_rx.recv().await {
                let payload = serde_json::to_string(&event)?;
                write.send(Message::Text(payload.into())).await?;
            }
            anyhow::Ok(())
        });

        let mut reader = tokio::spawn(async move {
            let mut connected_tx = connected_tx;
            while let Some(message) = read.next().await {
                let message = message?;
                if message.is_text() {
                    let text = message.to_text()?;
                    if is_realtime_connected_ack(text)? {
                        if let Some(connected_tx) = connected_tx.take() {
                            let _ = connected_tx.send(());
                        }
                        continue;
                    }
                    if let Some(event) = parse_realtime_message(text)? {
                        inbound_tx.send(event).await?;
                    }
                }
            }
            if connected_tx.is_some() {
                bail!("realtime connection closed before server acknowledgement");
            }
            anyhow::Ok(())
        });

        tokio::select! {
            writer_result = &mut writer => {
                reader.abort();
                writer_result??;
            }
            reader_result = &mut reader => {
                writer.abort();
                reader_result??;
            }
        }
        Ok(())
    }
}

fn is_realtime_connected_ack(text: &str) -> Result<bool> {
    let value: serde_json::Value = serde_json::from_str(text)?;
    Ok(value.get("type").and_then(|kind| kind.as_str()) == Some("connected"))
}
