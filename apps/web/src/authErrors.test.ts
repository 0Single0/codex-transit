import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authErrors";
import { messages } from "./i18n";

describe("authErrorMessage", () => {
  it("explains when an email is already registered", () => {
    expect(authErrorMessage(new Error("email_already_registered"), "register", messages.zh)).toBe(
      "该邮箱已经注册，请直接登录。"
    );
  });
});
