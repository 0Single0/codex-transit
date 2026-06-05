import { Laptop } from "lucide-react";
import type { AgentMessages } from "../messages";
import type { AgentDeviceOverview } from "../agentApi";

export function DeviceCard({
  device,
  active,
  labels
}: {
  device: AgentDeviceOverview;
  active: boolean;
  labels: Pick<AgentMessages, "thisDevice" | "version" | "online" | "idle">;
}) {
  return (
    <article className="device-card">
      <Laptop />
      <div>
        <strong>
          {device.name}
          <span>{labels.thisDevice}</span>
        </strong>
        <p>
          {device.osLabel} · {labels.version} {device.version}
        </p>
      </div>
      <span className={`mini-state ${active ? "allowed" : "muted"}`}>{active ? labels.online : labels.idle}</span>
    </article>
  );
}
