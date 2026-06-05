import { QrCode } from "lucide-react";
import type { DeviceSummary } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceListView } from "../components/DeviceListView";
import { PageHeader } from "../components/PageHeader";
import { useAppState } from "../features/app/AppStateContext";
import { buildDeviceProjectsPath, buildScanAgentPath } from "../routes";

export function DevicesPage() {
  const { api, labels, runAuthorized, setError } = useAppState();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void refreshDevices();
  }, []);

  async function refreshDevices() {
    const result = await runAuthorized(() => api.devices());
    if (!result) return;
    setDevices(result);
  }

  return (
    <>
      <PageHeader
        title={labels.myDevices}
        rightSlot={(
          <button
            aria-label={labels.scanAgent}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-500 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition hover:text-sky-600"
            onClick={() => navigate(buildScanAgentPath())}
            type="button"
          >
            <QrCode className="h-5 w-5" />
          </button>
        )}
      />
      <DeviceListView
        devices={devices}
        labels={labels}
        onSelect={(device) => navigate(buildDeviceProjectsPath(device.id))}
      />
    </>
  );
}
