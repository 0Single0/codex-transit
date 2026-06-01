import type { DeviceSummary } from "@codex-transit/shared";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { WebMessages } from "../i18n";
import { buildPairingPayload } from "../pairing";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export function DeviceListView(props: {
  bindCode: { code: string; expiresAt: string } | null;
  devices: DeviceSummary[];
  labels: WebMessages;
  onCreateBindCode: () => void;
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="stack">
      <div className="panel stack">
        <button onClick={props.onCreateBindCode}>{props.labels.createPairingCode}</button>
        <p className="hint">{props.labels.pairingHint}</p>
        {props.bindCode ? (
          <PairingCodePanel bindCode={props.bindCode} labels={props.labels} />
        ) : null}
      </div>
      {props.devices.map((device) => (
        <button className="list-row" key={device.id} onClick={() => props.onSelect(device)}>
          <span>{device.name}</span>
          <span className={device.online ? "status online" : "status"}>
            {device.online ? props.labels.online : props.labels.offline}
          </span>
        </button>
      ))}
    </section>
  );
}

function PairingCodePanel(props: {
  bindCode: { code: string; expiresAt: string };
  labels: WebMessages;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [hasQrError, setHasQrError] = useState(false);
  const payload = useMemo(() => buildPairingPayload(API_BASE, props.bindCode.code), [props.bindCode.code]);

  useEffect(() => {
    let active = true;
    setHasQrError(false);
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 192 })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
          setHasQrError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="pairing-panel">
      <div className="pairing-qr">
        {qrDataUrl ? <img alt={props.labels.scanToPair} src={qrDataUrl} /> : <span>{props.labels.scanToPair}</span>}
      </div>
      <div className="bind-code">
        <span>{props.labels.manualPairingCode}</span>
        <strong>{props.bindCode.code}</strong>
        <span>
          {props.labels.expires} {new Date(props.bindCode.expiresAt).toLocaleTimeString()}
        </span>
        {hasQrError ? <span className="error">{props.labels.qrUnavailable}</span> : null}
      </div>
    </div>
  );
}
