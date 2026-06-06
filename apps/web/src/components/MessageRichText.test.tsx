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

  it("renders markdown tables and fenced code blocks", () => {
    const html = renderToStaticMarkup(
      <MessageRichText
        text={[
          "| name | value |",
          "| --- | --- |",
          "| alpha | beta |",
          "",
          "```ts",
          "const total = 1 + 2;",
          "```"
        ].join("\n")}
        tone="codex"
      />
    );

    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("alpha");
    expect(html).toContain("<pre");
    expect(html).toContain("language-ts");
    expect(html).toContain("const total = 1 + 2;");
  });

  it("renders inline and block katex formulas", () => {
    const html = renderToStaticMarkup(
      <MessageRichText
        text={[
          "行内公式 $E=mc^2$",
          "",
          "$$",
          "\\int_0^1 x^2 dx",
          "$$"
        ].join("\n")}
        tone="codex"
      />
    );

    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
    expect(html).toContain("mathml");
  });
});
