import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("app error handling", () => {
  it("returns validation errors as 400 responses", async () => {
    const app = await buildApp({ jwtSecret: "01234567890123456789012345678901" });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "bad@example.com", password: "123" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });
    await app.close();
  });
});
