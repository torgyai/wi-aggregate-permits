"use client";

/** Friendly fallback for server errors (usually a missing database or setting). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        Most often this means the database or a setting isn&apos;t connected yet. The setup check shows exactly what&apos;s missing.
      </p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">Error reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <a href="/setup" className="btn">Open setup check</a>
        <button onClick={reset} className="btn-secondary">Try again</button>
      </div>
    </div>
  );
}
