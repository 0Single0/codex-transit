import type { DeviceSummary } from "@codex-transit/shared";
import type { WebMessages } from "../i18n";

export function DeviceListView(props: {
  devices: DeviceSummary[];
  labels: WebMessages;
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="stack">
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
