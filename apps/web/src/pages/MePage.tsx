import { Languages, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../features/app/AppStateContext";
import { buildLoginPath } from "../routes";

export function MePage() {
  const { labels, locale, setLocale, setToken } = useAppState();
  const navigate = useNavigate();

  return (
    <section className="h-full min-h-full px-5 pb-28 pt-6 text-slate-900">
      <h1 className="text-center text-xl font-semibold">{labels.tabMe}</h1>
      <div className="mt-8 space-y-4">
        <section className="rounded-[26px] bg-white p-5 shadow-[0_12px_34px_rgba(148,163,184,0.12)]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700">
              <Settings className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold">{labels.settings}</h2>
          </div>
          <label className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <Languages className="h-4 w-4" />
              {labels.language}
            </span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
            >
              <option value="zh">{labels.chinese}</option>
              <option value="en">{labels.english}</option>
            </select>
          </label>
        </section>
        <button
          className="h-14 w-full rounded-2xl bg-red-50 text-sm font-semibold text-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.08)]"
          onClick={() => {
            setToken(null);
            navigate(buildLoginPath(), { replace: true });
          }}
          type="button"
        >
          {labels.logout}
        </button>
      </div>
    </section>
  );
}
