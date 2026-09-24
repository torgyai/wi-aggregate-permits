import Link from "next/link";
import { CheckCircle2, Circle, CircleDashed, Hand, Rocket, Sparkles } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { launchChecklist, type CheckStatus } from "@/lib/launch";

export const dynamic = "force-dynamic";

const ICON: Record<CheckStatus, JSX.Element> = {
  done: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  todo: <Circle className="h-5 w-5 text-amber-500" />,
  manual: <Hand className="h-5 w-5 text-indigo-400" />,
  optional: <CircleDashed className="h-5 w-5 text-slate-300" />,
};
const LABEL: Record<CheckStatus, [string, "green" | "amber" | "indigo" | "gray"]> = {
  done: ["done", "green"],
  todo: ["to do", "amber"],
  manual: ["manual — you", "indigo"],
  optional: ["optional", "gray"],
};

export default async function LaunchPage() {
  const groups = await launchChecklist();
  const all = groups.flatMap((g) => g.items).filter((i) => i.status !== "optional");
  const done = all.filter((i) => i.status === "done").length;

  return (
    <>
      <PageHeader
        eyebrow="Launch checklist"
        title="Everything between here and closing deals"
        subtitle="Green items the app detected on its own. Blue hand items are manual steps only you can do; tick them off in your head (or your notes). The last step is turning on live sending."
      />
      <div className="card mb-8 flex flex-wrap items-center gap-6 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50"><Rocket className="h-6 w-6 text-indigo-600" /></div>
        <div className="flex-1">
          <div className="text-sm text-slate-500">Detected as done</div>
          <div className="text-2xl font-semibold">{done} of {all.length}</div>
          <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${(done / all.length) * 100}%` }} />
          </div>
        </div>
        <Link href="/training" className="btn-secondary"><Sparkles className="h-4 w-4" /> Training course</Link>
      </div>
      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.title} title={g.title}>
            <p className="-mt-2 mb-4 text-sm text-slate-500">{g.why}</p>
            <ul className="divide-y divide-slate-100">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5">{ICON[i.status]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{i.title}</span>
                      <Badge tone={LABEL[i.status][1]}>{LABEL[i.status][0]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{i.detail}</p>
                  </div>
                  {i.where && <Link href={i.where} className="btn-ghost shrink-0 text-xs">Open →</Link>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
