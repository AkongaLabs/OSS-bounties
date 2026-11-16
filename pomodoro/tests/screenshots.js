// Captures the screenshots used as evidence in the submission, including the states that
// matter for the bounty. Optional: needs Playwright (`bun add -d playwright`), then
// `bun run screenshots`.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { launchBrowser, loadPlaywright, startServer } from "./static-server.js";

const OUT = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const chromium = await loadPlaywright();
const server = await startServer();
const browser = await launchBrowser(chromium, { args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 900, height: 760 }, colorScheme: "light" });
await context.grantPermissions(["notifications"], { origin: server.origin });
const page = await context.newPage();
await page.goto(`${server.origin}/index.html`);

const shot = async (name) => {
  await page.waitForTimeout(400); // let the progress transition settle before capturing
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`wrote docs/screenshots/${name}.png`);
};

await shot("idle");

await page.fill("#minutes", "0");
await page.click("#start");
await shot("invalid-input");

await page.fill("#minutes", "0.25"); // 15 seconds
await page.click("#start");
await page.waitForTimeout(1100);
await shot("running");

await page.waitForFunction(() => window.__pomodoro.timer.snapshot().phase === "completed", null, { timeout: 20000 });
await shot("completed");

await page.click("#reset");
await page.emulateMedia({ colorScheme: "dark" });
await shot("dark-mode");
await page.emulateMedia({ colorScheme: "light" });

await page.click("summary");
await shot("shortcuts-and-help");

await browser.close();
server.close();
