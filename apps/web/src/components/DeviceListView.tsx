import type { DeviceSummary } from "@codex-transit/shared";

export function DeviceListView(props: {
  devices: DeviceSummary[];
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="stack">
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
