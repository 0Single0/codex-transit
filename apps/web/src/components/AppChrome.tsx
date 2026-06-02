import { MonitorSmartphone, UserRound } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { WebMessages } from "../i18n";
import { buildDevicesPath, buildMePath } from "../routes";

export function AppChrome(props: {
  labels: WebMessages;
  message: string | null;
  error: string | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const showBottomNav = location.pathname === buildDevicesPath() || location.pathname === buildMePath();

  return (
    <main className="h-full min-h-full bg-[#f0f4f7] text-slate-900">
      <section className="mx-auto h-full min-h-full max-w-[430px] bg-[#f0f4f7]">
        <Outlet />

        {props.message ? (
          <p className="fixed left-1/2 top-4 z-20 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-emerald-500/12 px-4 py-3 text-sm text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
            {props.message}
          </p>
        ) : null}
        {props.error ? (
          <p className="fixed left-1/2 top-4 z-20 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 shadow-[0_10px_30px_rgba(239,68,68,0.12)]">
            {props.error}
          </p>
        ) : null}

        {showBottomNav ? (
          <nav className="fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-2 border-t border-slate-200 bg-[#f0f4f7]/95 px-8 pb-5 pt-3 backdrop-blur">
            <button
              className={`grid justify-items-center gap-1 text-xs ${location.pathname === buildDevicesPath() ? "text-sky-700" : "text-slate-400"}`}
              onClick={() => navigate(buildDevicesPath())}
              type="button"
            >
              <MonitorSmartphone className="h-5 w-5" />
              {props.labels.tabDevices}
            </button>
            <button
              className={`grid justify-items-center gap-1 text-xs ${location.pathname === buildMePath() ? "text-sky-700" : "text-slate-400"}`}
              onClick={() => navigate(buildMePath())}
              type="button"
            >
              <UserRound className="h-5 w-5" />
              {props.labels.tabMe}
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
