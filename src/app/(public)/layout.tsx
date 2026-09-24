/** Client-facing pages (proposal, intake, unsubscribe) and login: no admin shell. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-stone-100">{children}</div>;
}
