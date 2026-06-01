import type { DeviceSummary } from "@codex-transit/shared";

export function DeviceListView(props: {
  bindCode: { code: string; expiresAt: string } | null;
  devices: DeviceSummary[];
  onCreateBindCode: () => void;
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="stack">
      <div className="panel stack">
        <button onClick={props.onCreateBindCode}>Create pairing code</button>
        {props.bindCode ? (
          <div className="bind-code">
            <strong>{props.bindCode.code}</strong>
            <span>Expires {new Date(props.bindCode.expiresAt).toLocaleTimeString()}</span>
          </div>
        ) : null}
      </div>
      {props.devices.map((device) => (
        <button className="list-row" key={device.id} onClick={() => props.onSelect(device)}>
          <span>{device.name}</span>
          <span className={device.online ? "status online" : "status"}>
            {device.online ? "Online" : "Offline"}
          </span>
        </button>
      ))}
    </section>
  );
}
