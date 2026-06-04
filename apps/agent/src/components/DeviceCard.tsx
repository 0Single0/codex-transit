import { Laptop } from "lucide-react";
import { AgentDeviceOverview } from "../agentApi";

export function DeviceCard({ device, active }: { device: AgentDeviceOverview; active: boolean }) {
  return (
    <article className="device-card">
      <Laptop />
      <div>
        <strong>
          {device.name}
          <span>本机</span>
        </strong>
        <p>
          {device.osLabel} · 版本 {device.version}
        </p>
      </div>
      <span className={`mini-state ${active ? "allowed" : "muted"}`}>{active ? "在线" : "待机"}</span>
    </article>
  );
}
