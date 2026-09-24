import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "./lib/session";

// Public: client-facing links, webhooks and cron (each verifies its own secret/token).
const PUBLIC = [/^\/login/, /^\/p\//, /^\/c\//, /^\/intake\//, /^\/u\//, /^\/api\/(cron|inbound|stripe|u)\//];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"] };
