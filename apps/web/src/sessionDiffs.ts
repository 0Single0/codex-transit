import type { RealtimeEvent } from "@codex-transit/shared";

export type DiffPreview = {
  relativePath: string;
  ok: boolean;
  text: string;
};

type DiffResultEvent = Extract<RealtimeEvent, { type: "diff.result" }>;

export function applyDiffResult(current: DiffPreview[], event: DiffResultEvent): DiffPreview[] {
  return [
    {
      relativePath: event.relativePath,
      ok: event.ok,
      text: event.ok ? event.diff ?? "" : event.error ?? ""
    },
    ...current
  ];
}
