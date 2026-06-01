import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/modules/auth/auth.service";

describe("auth service", () => {
  it("verifies a valid password hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });
});
