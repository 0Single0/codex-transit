import type { ConversationItem } from "../conversationItems";
import type { WebMessages } from "../i18n";
import { AttachmentPreview } from "./AttachmentPreview";
import { MessageRichText } from "./MessageRichText";
import { ToolCallCard } from "./ToolCallCard";

export function ConversationMessage(props: {
  item: ConversationItem;
  labels: WebMessages;
}) {
  const { item } = props;

  if (item.kind === "tool") {
    return (
      <div className="w-full px-1">
        <ToolCallCard labels={props.labels} toolCall={item.toolCall} />
      </div>
    );
  }

  const user = item.role === "user";
  return (
    <article className={`w-full px-1 ${user ? "text-right" : "text-left"}`}>
      {item.attachments?.length ? (
        <div className={`grid gap-2 ${user ? "justify-items-end" : "justify-items-start"}`}>
          {item.attachments.map((attachment) => (
            <div className="w-full max-w-[280px]" key={attachment.id}>
              <AttachmentPreview attachment={attachment} />
            </div>
          ))}
        </div>
      ) : null}
      <div className={`flex ${user ? "justify-end mt-3" : "justify-start"}`}>
        <div
          className={`rounded-[15px] px-3 py-3 whitespace-pre-wrap break-words font-sans text-[15px] leading-8 shadow-[0_10px_28px_rgba(148,163,184,0.08)] ${
            user
              ? "bg-[#ddebff] text-slate-900 ring-1 ring-[#c6daf8]"
              : "bg-white text-slate-800 ring-1 ring-slate-200/85"
          }`}
          style={{
            wordBreak:"break-all"
          }}
        >
          <MessageRichText text={item.text} tone={user ? "user" : "codex"} />
        </div>
      </div>
    </article>
  );
}
