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
    <section className="space-y-4 px-5 pb-28 pt-3 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{props.labels.connectedDevices}</h2>
        <span className="text-xs text-slate-500">{props.devices.length}</span>
      </div>

      {props.devices.length ? (
        <div className="space-y-4">
          {props.devices.map((device) => (
            <button
              className="group relative grid w-full grid-cols-[74px_1fr_auto] items-center gap-4 rounded-[26px] border border-white/10 bg-[#101822] p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.24)] transition hover:border-violet-400/40 hover:bg-[#121d29]"
              key={device.id}
              onClick={() => props.onSelect(device)}
              type="button"
            >
              <span className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                <span className={`h-1.5 w-1.5 rounded-full ${device.online ? "bg-emerald-300" : "bg-slate-500"}`} />
                {device.online ? props.labels.online : props.labels.offline}
              </span>
              <span className="grid h-[74px] w-[74px] place-items-center rounded-2xl bg-white/[0.04]">
                <img
                  alt=""
                  className="h-14 w-14 object-contain"
                  src={device.platform === "macos" ? macDevice : windowsDevice}
                />
              </span>
              <span className="min-w-0 pt-1">
                <strong className="block truncate text-[17px] font-semibold text-slate-50">{device.name}</strong>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {platformName(device.platform)} · {props.labels.deviceIpUnknown}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-slate-400">
                  <MonitorDot className="h-3.5 w-3.5" aria-hidden="true" />
                  {props.labels.bridgeVersion}
                </span>
              </span>
              <ChevronRight className="mt-10 h-5 w-5 text-slate-600 transition group-hover:text-violet-300" />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[360px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-sm leading-6 text-slate-500">
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
