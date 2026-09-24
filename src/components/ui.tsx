import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, icon: Icon, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: LucideIcon; padded?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 px-5 pb-1 pt-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {Icon && <Icon className="h-4 w-4 text-slate-400" />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const STAT_TONE = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
};

export function Stat({ label, value, hint, icon: Icon, tone = "indigo" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: keyof typeof STAT_TONE }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && (
          <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", STAT_TONE[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-600 ring-slate-500/10",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

export function Badge({ children, tone = "gray", dot }: { children: ReactNode; tone?: keyof typeof TONES; dot?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? "from-emerald-400 to-emerald-600" : score >= 50 ? "from-amber-300 to-amber-500" : "from-slate-300 to-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full bg-gradient-to-r", tone)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="w-6 text-xs font-medium tabular-nums text-slate-600">{score}</span>
    </div>
  );
}

export function Empty({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
      {Icon && <Icon className="h-6 w-6 text-slate-300" />}
      <div>{children}</div>
    </div>
  );
}

export function Callout({ tone = "indigo", children, icon: Icon }: { tone?: "indigo" | "amber" | "emerald" | "rose"; children: ReactNode; icon?: LucideIcon }) {
  const t = {
    indigo: "border-indigo-200 bg-indigo-50/70 text-indigo-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    rose: "border-rose-200 bg-rose-50/70 text-rose-900",
  }[tone];
  return (
    <div className={clsx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", t)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export const STAGE_TONE: Record<string, keyof typeof TONES> = {
  NEW: "gray",
  CONTACTED: "blue",
  ENGAGED: "amber",
  MEETING: "violet",
  PROPOSAL: "indigo",
  WON: "green",
  LOST: "red",
};

export const APPLICABILITY_TONE: Record<string, keyof typeof TONES> = {
  REQUIRED: "red",
  LIKELY: "amber",
  CHECK: "blue",
  OPTIONAL: "gray",
  NO: "gray",
};
