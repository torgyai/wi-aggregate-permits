import { SubmitButton } from "@/components/SubmitButton";
import { login } from "../../actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={login} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-lg font-bold">Stratex Aggregate</h1>
          <p className="text-sm text-stone-500">Wisconsin pit &amp; quarry permitting autopilot</p>
        </div>
        {searchParams.error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">Wrong email or password.</p>}
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
  );
}
