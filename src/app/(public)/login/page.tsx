import { Mountain } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "../../actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-12 text-white md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600"><Mountain className="h-4 w-4" /></div>
          <span className="font-semibold">Stratex Aggregate</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Wisconsin pit &amp; quarry permitting,<br />on autopilot.</h1>
          <p className="mt-4 max-w-md text-slate-300">Find operators that need permits, reach them, send the proposal, collect the site data and draft every application — you take the call and file.</p>
        </div>
        <div className="text-xs text-slate-500">NR 135 · WPDES · Air · High-cap wells · SPCC · MSHA</div>
      </div>
      <div className="flex items-center justify-center px-6">
        <form action={login} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-slate-500">Operator account</p>
          </div>
          {searchParams.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Wrong email or password.</p>}
          <input type="hidden" name="next" value={searchParams.next ?? "/"} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <SubmitButton className="btn w-full">Sign in</SubmitButton>
        </form>
      </div>
    </div>
  );
}
