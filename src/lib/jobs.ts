import { db } from "./db";

/** Run a unit of autopilot work and log it to JobRun (shown on the dashboard). */
export async function runJob<T extends { summary: string }>(job: string, fn: () => Promise<T>): Promise<T> {
  const run = await db.jobRun.create({ data: { job } });
  try {
    const result = await fn();
    await db.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, summary: result.summary.slice(0, 2000) },
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, summary: msg.slice(0, 2000) },
    });
    throw err;
  }
}
