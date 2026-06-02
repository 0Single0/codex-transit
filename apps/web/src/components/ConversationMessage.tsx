import type { ConversationItem } from "../conversationItems";
import { AttachmentPreview } from "./AttachmentPreview";
import { ToolCallCard } from "./ToolCallCard";

export function ConversationMessage(props: { item: ConversationItem }) {
  const { item } = props;

  if (item.kind === "tool") {
    return (
      <div className="mr-auto max-w-[92%]">
        <ToolCallCard toolCall={item.toolCall} />
      </div>
    );
  }

  const user = item.role === "user";
  return (
    <article className={`max-w-[92%] space-y-3 ${user ? "ml-auto text-right" : "mr-auto text-left"}`}>
      {item.attachments?.length ? (
        <div className={`grid gap-2 ${user ? "justify-items-end" : "justify-items-start"}`}>
          {item.attachments.map((attachment) => (
            <div className="w-full max-w-[280px]" key={attachment.id}>
              <AttachmentPreview attachment={attachment} />
            </div>
          ))}
        </div>
      ) : null}
      <pre className={`whitespace-pre-wrap break-words font-sans text-[15px] leading-7 ${user ? "text-white" : "text-slate-100"}`}>
        {item.text}
      </pre>
    </article>
  );
}
