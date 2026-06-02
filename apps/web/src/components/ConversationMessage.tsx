import type { ConversationItem } from "../conversationItems";
import { AttachmentPreview } from "./AttachmentPreview";
import { ToolCallCard } from "./ToolCallCard";

export function ConversationMessage(props: { item: ConversationItem }) {
  const { item } = props;

  if (item.kind === "tool") {
    return (
      <div className="w-full px-1">
        <ToolCallCard toolCall={item.toolCall} />
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
      <div className={`mt-3 ${user ? "flex justify-end" : "flex justify-start"}`}>
        <pre
          className={`max-w-full whitespace-pre-wrap break-words rounded-[20px] px-4 py-3 font-sans text-[15px] leading-7 ${
            user
              ? "bg-white/[0.08] text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
              : "bg-transparent px-0 py-0 text-slate-100"
          }`}
        >
          {item.text}
        </pre>
      </div>
    </article>
  );
}
