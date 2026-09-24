import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold", tone === "good" && "text-emerald-700", tone === "warn" && "text-amber-700")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  gray: "bg-stone-100 text-stone-700",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={clsx("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

export function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-stone-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
        <div className={clsx("h-full", tone)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="w-6 text-xs tabular-nums text-stone-600">{score}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">{children}</div>;
}

export const STAGE_TONE: Record<string, keyof typeof TONES> = {
  NEW: "gray",
  CONTACTED: "blue",
  ENGAGED: "amber",
  MEETING: "violet",
  PROPOSAL: "amber",
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
