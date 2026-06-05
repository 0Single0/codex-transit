import type { AttachmentItem } from "../conversationItems";

export function AttachmentPreview(props: { attachment: AttachmentItem }) {
  const { attachment } = props;
  const imageSource = attachment.previewUrl ?? (attachment.kind === "image" && isRemoteUrl(attachment.path) ? attachment.path : null);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-2.5 py-2 text-left text-sm text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.12)] ring-1 ring-slate-200/70">
      {imageSource ? (
        <img
          alt={attachment.name}
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/80"
          src={imageSource}
        />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-[11px] font-medium uppercase text-slate-500">
          {attachment.kind === "image" ? "IMG" : "FILE"}
        </span>
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] font-medium leading-5 text-slate-800">{attachment.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{attachment.mimeType ?? attachment.path}</p>
      </div>
    </div>
  );
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
