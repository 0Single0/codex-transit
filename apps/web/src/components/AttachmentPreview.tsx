import type { AttachmentItem } from "../conversationItems";

export function AttachmentPreview(props: { attachment: AttachmentItem }) {
  const { attachment } = props;
  if (attachment.kind === "image" && attachment.previewUrl) {
    return (
      <figure className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]">
        <img alt={attachment.name} className="max-h-56 w-full object-cover" src={attachment.previewUrl} />
        <figcaption className="px-3 py-2 text-xs text-slate-400">{attachment.name}</figcaption>
      </figure>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-200">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] text-xs uppercase text-slate-400">
        {attachment.kind === "image" ? "IMG" : "FILE"}
      </span>
      <div className="min-w-0">
        <p className="truncate">{attachment.name}</p>
        <p className="truncate text-xs text-slate-500">{attachment.mimeType ?? attachment.path}</p>
      </div>
    </div>
  );
}
