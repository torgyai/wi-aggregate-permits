/** Run one autopilot tick locally: npm run autopilot:tick */
import { tick } from "../src/lib/autopilot";
import { db } from "../src/lib/db";

tick()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
