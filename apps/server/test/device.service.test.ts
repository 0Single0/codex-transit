import { describe, expect, it } from "vitest";
import { hashSecret, verifySecret } from "../src/modules/devices/device.service";

describe("device service", () => {
  it("verifies a matching device token hash", () => {
    const hash = hashSecret("device-token");
    expect(verifySecret(hash, "device-token")).toBe(true);
  });

  it("rejects a non-matching device token", () => {
    const hash = hashSecret("device-token");
    expect(verifySecret(hash, "other-token")).toBe(false);
  });
});
