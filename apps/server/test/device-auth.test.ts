import { describe, expect, it, vi } from "vitest";
import { authenticateDeviceToken, readDeviceTokenHeader } from "../src/modules/devices/device-auth";
import { hashSecret } from "../src/modules/devices/device.service";

describe("device auth", () => {
  it("reads x-device-token header values", () => {
    expect(readDeviceTokenHeader("device-token")).toBe("device-token");
    expect(readDeviceTokenHeader(["first", "second"])).toBe("first");
    expect(readDeviceTokenHeader(undefined)).toBeNull();
  });

  it("authenticates matching device tokens", async () => {
    const device = {
      id: "device-1",
      userId: "user-1",
      tokenHash: hashSecret("device-token")
    };
    const prisma = {
      device: {
        findUnique: vi.fn().mockResolvedValue(device)
      }
    };

    await expect(authenticateDeviceToken(prisma as never, "device-1", "device-token")).resolves.toBe(device);
  });

  it("rejects invalid device tokens", async () => {
    const prisma = {
      device: {
        findUnique: vi.fn().mockResolvedValue({
          id: "device-1",
          userId: "user-1",
          tokenHash: hashSecret("device-token")
        })
      }
    };

    await expect(authenticateDeviceToken(prisma as never, "device-1", "wrong")).resolves.toBeNull();
  });
});
