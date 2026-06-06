import { FileCode2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

type FileReference = {
  label: string;
  path: string;
  displayName: string;
  lineInfo: string | null;
};

type MessageBlock =
  | { kind: "text"; content: string }
  | { kind: "file"; file: FileReference };

export function MessageRichText(props: {
  text: string;
  tone: "user" | "codex";
}) {
  const blocks = parseMessageBlocks(props.text);

  return (
    <div className="message-markdown space-y-1.5">
      {blocks.map((block, index) => {
        if (block.kind === "file") {
          return (
            <div className="space-y-2" key={`${block.file.path}-${index}`}>
              <div className={`flex items-start gap-3 rounded-[18px] px-3 py-3 ${fileCardClass(props.tone)}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                  <FileCode2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{block.file.displayName}</p>
                  {block.file.lineInfo ? (
                    <p className="mt-1 truncate text-xs leading-5 text-slate-500">{block.file.lineInfo}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }

        return (
            <div className={`text-[15px] leading-6 ${toneClass(props.tone)}`} key={`text-${index}`}>
              <ReactMarkdown
              components={{
                p: ({ children }) => <p className="break-words whitespace-pre-wrap leading-7">{children}</p>,
                h1: ({ children }) => <h1 className="text-[1.1rem] font-semibold leading-7 text-slate-900">{children}</h1>,
                h2: ({ children }) => <h2 className="text-[1.02rem] font-semibold leading-7 text-slate-900">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold leading-6 text-slate-900">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 leading-3 marker:text-slate-500">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 leading-3 marker:text-slate-500">{children}</ol>,
                li: ({ children }) => <li className="break-words py-0.5 leading-6">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="rounded-r-2xl border-l-4 border-sky-200 bg-sky-50/70 px-4 py-2.5 leading-6 text-slate-700">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    className="break-all font-medium text-sky-700 underline decoration-sky-300 underline-offset-2"
                    href={href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
                    <table className="min-w-full border-collapse text-left text-[14px] leading-6">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-50 text-slate-900">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-slate-200/80">{children}</tbody>,
                tr: ({ children }) => <tr className="align-top">{children}</tr>,
                th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 text-slate-700">{children}</td>,
                pre: ({ children }) => (
                  <pre className="my-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100 shadow-[0_16px_36px_rgba(15,23,42,0.22)]">
                    {children}
                  </pre>
                ),
                code: ({ className, children }) => {
                  const isBlockCode = typeof className === "string" && className.includes("language-");
                  if (isBlockCode) {
                    return <code className={`${className} block min-w-max font-mono`}>{children}</code>;
                  }

                  return (
                    <code className="rounded-md bg-slate-200/75 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900">
                      {children}
                    </code>
                  );
                },
                hr: () => <hr className="my-3 border-slate-200" />,
                img: ({ src, alt }) => (
                  <img
                    alt={alt ?? ""}
                    className="my-2.5 rounded-2xl border border-slate-200/80 shadow-[0_12px_28px_rgba(148,163,184,0.12)]"
                    loading="lazy"
                    src={src}
                  />
                )
              }}
              rehypePlugins={[rehypeKatex]}
              remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
            >
              {block.content}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

function parseMessageBlocks(text: string): MessageBlock[] {
  const lines = text.split("\n");
  const blocks: MessageBlock[] = [];
  const filePattern = /^(?:修改文件:|淇敼鏂囦欢:)?\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;
  let currentText: string[] = [];

  function flushText() {
    const content = currentText.join("\n").trim();
    if (content) {
      blocks.push({ kind: "text", content });
    }
    currentText = [];
  }

  for (const line of lines) {
    const match = line.match(filePattern);
    if (match) {
      const [, label = "", rawPath = ""] = match;
      flushText();
      const { path, lineInfo } = normalizeFilePath(rawPath);
      blocks.push({
        kind: "file",
        file: {
          label,
          path,
          displayName: basename(label),
          lineInfo
        }
      });
      continue;
    }
    currentText.push(line);
  }

  flushText();
  return blocks;
}

function toneClass(tone: "user" | "codex") {
  return tone === "user" ? "text-slate-900" : "text-slate-700";
}

function fileCardClass(tone: "user" | "codex") {
  return tone === "user"
    ? "bg-[#f3f6fa] shadow-[0_10px_24px_rgba(148,163,184,0.12)] ring-1 ring-slate-200/70"
    : "bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)] ring-1 ring-slate-200/70";
}

function normalizeFilePath(rawPath: string) {
  const lineMatch = rawPath.match(/^(.*?):(\d+)$/);
  if (!lineMatch) {
    return { path: rawPath, lineInfo: null };
  }

  const [, path = rawPath, line = ""] = lineMatch;
  return {
    path,
    lineInfo: `${basename(path)} (line ${line})`
  };
}

function basename(value: string) {
  const normalized = value.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? value;
}
