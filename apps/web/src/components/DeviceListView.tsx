import type { DeviceSummary } from "@codex-transit/shared";
import type { WebMessages } from "../i18n";

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
          <div className="bind-code">
            <strong>{props.bindCode.code}</strong>
            <span>
              {props.labels.expires} {new Date(props.bindCode.expiresAt).toLocaleTimeString()}
            </span>
          </div>
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
