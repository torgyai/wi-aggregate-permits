/**
 * Load the MSHA registry from the command line (useful when the server can't
 * reach MSHA, or for the first big import).
 *   npm run msha:sync                      # download from MSHA
 *   npm run msha:sync -- --file Mines.zip  # use a local Mines.zip or Mines.txt
 */
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { runJob } from "../src/lib/jobs";
import { syncMsha } from "../src/lib/prospecting";

async function main() {
  const i = process.argv.indexOf("--file");
  const bytes = i > 0 ? new Uint8Array(readFileSync(process.argv[i + 1])) : undefined;
  const result = await runJob("msha", () => syncMsha({ bytes }));
  console.log(result.summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
