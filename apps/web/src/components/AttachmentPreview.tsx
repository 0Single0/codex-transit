import type { AttachmentItem } from "../conversationItems";

export function AttachmentPreview(props: { attachment: AttachmentItem }) {
  const { attachment } = props;

  if (attachment.kind === "image" && attachment.previewUrl) {
    return (
      <figure className="overflow-hidden rounded-[22px] bg-white shadow-[0_12px_30px_rgba(148,163,184,0.14)] ring-1 ring-slate-200/70">
        <img alt={attachment.name} className="max-h-56 w-full object-cover" src={attachment.previewUrl} />
        <figcaption className="px-3 py-2.5 text-xs text-slate-500">{attachment.name}</figcaption>
      </figure>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-white px-3 py-3 text-sm text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.14)] ring-1 ring-slate-200/70">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xs uppercase text-slate-500">
        {attachment.kind === "image" ? "IMG" : "FILE"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium">{attachment.name}</p>
        <p className="truncate text-xs text-slate-500">{attachment.mimeType ?? attachment.path}</p>
      </div>
    </div>
  );
}
