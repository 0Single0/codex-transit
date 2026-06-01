use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::protocol::RealtimeEvent;

pub struct ServerClient {
    url: String
}

impl ServerClient {
    pub fn new(url: impl Into<String>) -> Self {
        Self { url: url.into() }
    }

    pub async fn connect(
        &self,
        outbound_rx: mpsc::Receiver<RealtimeEvent>,
        inbound_tx: mpsc::Sender<RealtimeEvent>
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
