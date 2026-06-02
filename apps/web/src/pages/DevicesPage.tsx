import type { DeviceSummary } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceListView } from "../components/DeviceListView";
import { PageHeader } from "../components/PageHeader";
import { useAppState } from "../features/app/AppStateContext";
import { buildDeviceProjectsPath } from "../routes";

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
      <PageHeader title={labels.myDevices} />
      <DeviceListView
        devices={devices}
        labels={labels}
        onSelect={(device) => navigate(buildDeviceProjectsPath(device.id))}
      />
    </>
  );
}
