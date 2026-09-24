import { SubmitButton } from "@/components/SubmitButton";
import { readUnsubscribeToken } from "@/lib/tokens";
import { unsubscribeAction } from "../../../actions";

export const dynamic = "force-dynamic";

/** Confirm page (GET never unsubscribes by itself — link scanners prefetch). */
export default function UnsubscribePage({ params, searchParams }: { params: { token: string }; searchParams: { done?: string } }) {
  const email = readUnsubscribeToken(params.token);
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="card p-8 text-center">
        {!email ? (
          <p>This link isn&apos;t valid.</p>
        ) : searchParams.done ? (
          <>
            <h1 className="text-lg font-semibold">You&apos;re unsubscribed.</h1>
            <p className="mt-2 text-sm text-stone-600">{email} won&apos;t receive further emails from us.</p>
          </>
        ) : (
          <form action={unsubscribeAction.bind(null, params.token)} className="space-y-4">
            <h1 className="text-lg font-semibold">Unsubscribe {email}?</h1>
            <SubmitButton>Unsubscribe</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
