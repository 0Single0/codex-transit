import { describe, expect, it } from "vitest";
import {
  buildDeviceProjectsPath,
  buildDevicesPath,
  buildLoginPath,
  buildMePath,
  buildProjectHistoryPath,
  buildProjectHomePath,
  buildSessionPath,
  normalizePostLoginRedirect,
  readPostLoginRedirect
} from "./routes";

describe("routes helpers", () => {
  it("builds nested project and session paths", () => {
    expect(buildDevicesPath()).toBe("/devices");
    expect(buildDeviceProjectsPath("device-1")).toBe("/devices/device-1/projects");
    expect(buildProjectHomePath("device-1", "project-1")).toBe("/devices/device-1/projects/project-1");
    expect(buildProjectHistoryPath("device-1", "project-1")).toBe("/devices/device-1/projects/project-1/history");
    expect(buildSessionPath("device-1", "project-1", "session-1")).toBe("/devices/device-1/projects/project-1/sessions/session-1");
    expect(buildLoginPath()).toBe("/login");
    expect(buildMePath()).toBe("/me");
  });

  it("keeps only internal redirect targets after login", () => {
    expect(normalizePostLoginRedirect("/devices/device-1/projects/project-1")).toBe("/devices/device-1/projects/project-1");
    expect(normalizePostLoginRedirect("https://evil.example")).toBe("/devices");
    expect(normalizePostLoginRedirect("//evil.example")).toBe("/devices");
    expect(normalizePostLoginRedirect("")).toBe("/devices");
  });

  it("reads redirect targets from query strings safely", () => {
    expect(readPostLoginRedirect("?redirect=%2Fme")).toBe("/me");
    expect(readPostLoginRedirect("?redirect=https%3A%2F%2Fevil.example")).toBe("/devices");
    expect(readPostLoginRedirect("")).toBe("/devices");
  });
});
