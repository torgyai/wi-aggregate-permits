import { NextResponse } from "next/server";
import { markBalancePaid, markDepositPaid } from "@/lib/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 400 });
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  // ACH settles asynchronously: count it paid on async_payment_succeeded, cards on completed+paid.
  if (
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const proposalId = event.data.object.metadata?.proposalId;
    const kind = event.data.object.metadata?.kind ?? "deposit";
    if (proposalId) await (kind === "balance" ? markBalancePaid(proposalId) : markDepositPaid(proposalId));
  }
  return NextResponse.json({ received: true });
}
