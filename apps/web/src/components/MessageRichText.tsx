import { FileCode2 } from "lucide-react";

type FileReference = {
  label: string;
  path: string;
};

type MessageBlock =
  | { kind: "text"; content: string }
  | { kind: "file"; prefix: string; file: FileReference };

export function MessageRichText(props: {
  text: string;
  tone: "user" | "codex";
}) {
  const blocks = parseMessageBlocks(props.text);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.kind === "file") {
          return (
            <div className="space-y-2" key={`${block.file.path}-${index}`}>
              {block.prefix ? (
                <p className={`whitespace-pre-wrap break-words text-[15px] leading-7 ${toneClass(props.tone)}`}>
                  {block.prefix}
                </p>
              ) : null}
              <div className={`flex items-start gap-3 rounded-[18px] px-3 py-3 ${fileCardClass(props.tone)}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                  <FileCode2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{block.file.label}</p>
                  <p className="mt-1 break-all text-xs leading-5 text-slate-500">{block.file.path}</p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <p className={`whitespace-pre-wrap break-words text-[15px] leading-7 ${toneClass(props.tone)}`} key={`text-${index}`}>
            {block.content}
          </p>
        );
      })}
    </div>
  );
}

function parseMessageBlocks(text: string): MessageBlock[] {
  const lines = text.split("\n");
  const blocks: MessageBlock[] = [];
  const filePattern = /^(修改文件:)\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;
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
      const [, prefix = "", label = "", path = ""] = match;
      flushText();
      blocks.push({
        kind: "file",
        prefix,
        file: {
          label,
          path
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
