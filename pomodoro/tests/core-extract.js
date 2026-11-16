// Lifts the pure logic block out of the shipped index.html and evaluates it, so the tests
// exercise exactly the code Chrome runs instead of a second copy that can drift out of sync.
import { readFileSync } from "node:fs";

const CORE_BLOCK = /\/\*<core-logic>\*\/([\s\S]*?)\/\*<\/core-logic>\*\//;

const EXPORTS = [
  "MIN_TOTAL_MS",
  "MAX_MINUTES",
  "parseMinutes",
  "formatClock",
  "durationLabel",
  "notificationPayload",
  "CHIME_NOTES",
  "createChimeGraph",
  "createChimePlayer",
  "createTimer",
  "holdKeepAlive",
  "audioNoticeMessage",
  "notificationNoticeMessage",
];

export function loadCore(pageUrl = new URL("../index.html", import.meta.url)) {
  const html = readFileSync(pageUrl, "utf8");
  const match = html.match(CORE_BLOCK);
  if (!match) throw new Error(`no /*<core-logic>*/ block found in ${pageUrl.pathname}`);

  const source = match[1];
  // No DOM, no globals: the block only touches AudioContext objects that are passed in.
  const factory = new Function(`${source}\nreturn { ${EXPORTS.join(", ")} };`);

  return { html, source, core: factory(), exports: EXPORTS };
}
