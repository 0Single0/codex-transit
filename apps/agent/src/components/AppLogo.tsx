export function AppLogo({ size = "normal" }: { size?: "tiny" | "normal" | "large" }) {
  return (
    <span className={`app-logo ${size}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <rect x="7" y="7" width="50" height="50" rx="11" />
        <path d="M20 19l15 13-15 13" />
        <path d="M36 43h11" />
      </svg>
    </span>
  );
}
