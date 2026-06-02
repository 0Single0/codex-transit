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
      <div className={`mt-3 flex ${user ? "justify-end" : "justify-start"}`}>
        <div className="max-w-full whitespace-pre-wrap break-words font-sans text-[15px] leading-7">
          <MessageRichText text={item.text} tone={user ? "user" : "codex"} />
        </div>
      </div>
    </article>
  );
}
