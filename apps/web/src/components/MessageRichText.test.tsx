import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageRichText } from "./MessageRichText";

describe("MessageRichText", () => {
  it("renders file reference blocks as a compact label", () => {
    const html = renderToStaticMarkup(
      <MessageRichText
        text={"修改文件: [apps/web/src/components/DeviceListView.tsx](E:/code/codex-transit/apps/web/src/components/DeviceListView.tsx:28)"}
        tone="codex"
      />
    );

    expect(html).toContain("DeviceListView.tsx");
    expect(html).toContain("DeviceListView.tsx (line 28)");
    expect(html).not.toContain("apps/web/src/components/");
    expect(html).not.toContain("E:/code/codex-transit/");
    expect(html).not.toContain("修改文件:");
  });

  it("accepts a plain markdown file reference too", () => {
    const html = renderToStaticMarkup(
      <MessageRichText
        text={"[apps/web/src/components/DeviceListView.tsx](E:/code/codex-transit/apps/web/src/components/DeviceListView.tsx:28)"}
        tone="codex"
      />
    );

    expect(html).toContain("DeviceListView.tsx");
    expect(html).toContain("DeviceListView.tsx (line 28)");
    expect(html).not.toContain("apps/web/src/components/");
    expect(html).not.toContain("E:/code/codex-transit/");
  });
});
