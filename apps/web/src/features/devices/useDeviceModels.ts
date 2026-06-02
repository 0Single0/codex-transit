import type { CodexModel, RealtimeEvent } from "@codex-transit/shared";
import { useEffect, useState } from "react";
import { ApiClient } from "../../api/client";
import { connectDeviceStream } from "../../api/realtime";

export type DeviceModelState = {
  models: CodexModel[];
  defaultModel: string | null;
  loading: boolean;
  error: string | null;
};

export function useDeviceModels(options: {
  token: string | null;
  deviceId: string | null;
  api: ApiClient;
  fallbackError: string;
}) {
  const [state, setState] = useState<DeviceModelState>({
    models: [],
    defaultModel: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!options.token || !options.deviceId) return;

    setState((current) => ({
      ...current,
      loading: true,
      error: null
    }));

    const stream = connectDeviceStream({
      token: options.token,
      deviceId: options.deviceId,
      onEvent(event: RealtimeEvent) {
        if (event.type !== "device.models.updated") return;
        setState({
          models: event.models,
          defaultModel: event.defaultModel ?? null,
          loading: false,
          error: event.error ?? null
        });
      }
    });

    void stream.ready.then(async () => {
      try {
        await options.api.refreshDeviceModels(options.deviceId!);
      } catch (caught) {
        setState((current) => ({
          ...current,
          loading: false,
          error: caught instanceof Error ? caught.message : options.fallbackError
        }));
      }
    });

    return () => {
      stream.close();
    };
  }, [options.api, options.deviceId, options.fallbackError, options.token]);

  return state;
}
