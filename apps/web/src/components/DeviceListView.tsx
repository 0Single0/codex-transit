import type { DeviceSummary } from "@codex-transit/shared";
import { ChevronRight, MonitorDot } from "lucide-react";
import macDevice from "../assets/mac-device.png";
import windowsDevice from "../assets/windows-device.png";
import type { WebMessages } from "../i18n";

export function DeviceListView(props: {
  devices: DeviceSummary[];
  labels: WebMessages;
  onSelect: (device: DeviceSummary) => void;
}) {
  return (
    <section className="space-y-4 px-5 pb-28 pt-3 text-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500">{props.labels.connectedDevices}</h2>
        <span className="text-xs text-slate-500">{props.devices.length}</span>
      </div>

      {props.devices.length ? (
        <div className="space-y-4">
          {props.devices.map((device) => (
            <button
              className="group relative grid w-full grid-cols-[74px_1fr_auto] items-center gap-4 rounded-[18px] bg-white p-4 text-left transition hover:bg-slate-50"
              key={device.id}
              onClick={() => props.onSelect(device)}
              type="button"
            >
              <span className={`absolute right-5 top-5 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${device.online ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${device.online ? "bg-emerald-500" : "bg-slate-400"}`} />
                {device.online ? props.labels.online : props.labels.offline}
              </span>
              <span className="grid h-[74px] w-[74px] place-items-center rounded-2xl">
                <img
                  alt=""
                  className="h-[74px] w-[74px] object-contain"
                  src={device.platform === "macos" ? macDevice : windowsDevice}
                />
              </span>
              <span className="min-w-0 pt-1">
                <strong className="block truncate text-[17px] font-semibold text-slate-900">{device.name}</strong>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {platformName(device.platform)} · {props.labels.deviceIpUnknown}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                  <MonitorDot className="h-3.5 w-3.5" aria-hidden="true" />
                  {props.labels.bridgeVersion}
                </span>
              </span>
              <ChevronRight className="mt-10 h-5 w-5 text-slate-400 transition group-hover:text-sky-600" />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[360px] place-items-center rounded-[18px] bg-white p-8 text-center text-sm leading-6 text-slate-500">
          {props.labels.noDevices}
        </div>
      )}
    </section>
  );
}

function platformName(platform: DeviceSummary["platform"]) {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  return "Desktop";
}
