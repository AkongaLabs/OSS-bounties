// Optional real-browser check. The app itself never loads this file.
//
//   bun add -d playwright
//   bun run e2e
//
// It drives the Chrome already installed on the machine (the browser this bounty targets) and
// falls back to Edge, then to Playwright's own Chromium.
//
// Background audio cannot be proven headlessly, so this script proves everything around it:
// the chime is armed in advance on the audio clock, the countdown is derived from the wall
// clock, the page fetches nothing, and the completion path (status, title, notification) fires.
// The sound itself is checked by hand, see TESTING.md.
import { launchBrowser, loadPlaywright, startServer } from "./static-server.js";

const chromium = await loadPlaywright();
const server = await startServer();

const results = [];
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    const tail = consoleLog.slice(-12).join("\n      ");
    results.push(`FAIL  ${name}\n      ${error.message.split("\n").join("\n      ")}${tail ? `\n      --- page console ---\n      ${tail}` : ""}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertInRange(value, min, max, message) {
  assert(value >= min && value <= max, `${message} (got ${value}, expected ${min}..${max})`);
}

const PAGE = "/index.html";
const origin = server.origin;
const browser = await launchBrowser(chromium, { args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext();
await context.grantPermissions(["notifications"], { origin });
const page = await context.newPage();

const consoleErrors = [];
const consoleLog = [];
const requests = [];
page.on("console", (message) => {
  consoleLog.push(`${message.type()}: ${message.text()}`);
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  consoleErrors.push(String(error));
  consoleLog.push(`pageerror: ${error}`);
});
page.on("request", (request) => {
  if (!request.url().startsWith("data:")) requests.push(request.url());
});

const state = () => page.evaluate(() => window.__pomodoro.timer.snapshot());
const audio = () => page.evaluate(() => window.__pomodoro.player.debug());
const diagnostics = () => page.evaluate(() => window.__pomodoro.diagnostics);
const text = (selector) => page.textContent(selector);

const waitForPhase = (phase, timeout = 5000) =>
  page.waitForFunction((expected) => window.__pomodoro.timer.snapshot().phase === expected, phase, { timeout });

const startTimer = async (minutes) => {
  await page.fill("#minutes", String(minutes));
  await page.click("#start");
  await waitForPhase("running"); // toggle() awaits the audio and permission handling first
};

await page.goto(`${origin}${PAGE}`);

await check("loads as a single page with no external requests", async () => {
  await page.waitForTimeout(300); // give a favicon fallback request time to show up if there is one
  assert(requests.length === 1, `expected only the page request, saw: ${requests.join(", ")}`);
  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(" | ")}`);
  assert((await page.title()) === "Pomodoro", "unexpected title");
  assert((await text("#display")) === "25:00", "initial display should be 25:00");
  assert((await state()).phase === "idle", "should start idle");
  const icon = await page.getAttribute("link[rel=icon]", "href");
  assert(icon?.startsWith("data:image/svg+xml"), `the favicon should be inline, got ${icon}`);

  // The countdown has to be the visual focus, not body text with an id.
  const displayFontSize = await page.evaluate(() => getComputedStyle(document.getElementById("display")).fontSize);
  assert(parseFloat(displayFontSize) >= 40, `the countdown should be large, got ${displayFontSize}`);
});

await check("rejects invalid minutes and explains why", async () => {
  const cases = [
    ["0", "at least 1 second"],
    ["0.016", "at least 1 second"],
    ["1000", "at most"],
    ["", "Enter a number"],
  ];

  for (const [value, expected] of cases) {
    await page.fill("#minutes", value);
    await page.click("#start");
    const message = await text("#input-error");
    assert(message.includes(expected), `input ${JSON.stringify(value)}: expected "${expected}" in "${message}"`);
    assert((await page.getAttribute("#minutes", "aria-invalid")) === "true", `input ${JSON.stringify(value)} not marked invalid`);
    assert((await state()).phase === "idle", `input ${JSON.stringify(value)} started the timer anyway`);
  }

  // Chrome's number input refuses letters, so typed text arrives empty and is rejected as empty.
  const sanitized = await page.evaluate(() => {
    const input = document.getElementById("minutes");
    input.value = "abc";
    return input.value;
  });
  assert(sanitized === "", `a number input should sanitize "abc" to "", got ${JSON.stringify(sanitized)}`);
  await page.click("#start");
  assert((await text("#input-error")).includes("Enter a number"), "an empty field should ask for a number");

  await page.fill("#minutes", "25");
});

await check("the chime is armed on the audio clock, in advance", async () => {
  await startTimer(0.5); // the bounty's own test scenario: 30 seconds

  const armed = await audio();
  assert(armed.unlocked === true, `audio should be unlocked after Start, got ${JSON.stringify(armed)}`);
  assert(armed.armed === true, "no chime was armed");
  assert((await text("#display")) === "00:30", "a 30 second timer should read 00:30");
  assertInRange(armed.armedForAudioTime - armed.audioTime, 28, 30, "chime should be armed ~30s of audio time ahead");

  await page.waitForTimeout(2000);
  const later = await audio();
  assertInRange(later.audioTime - armed.audioTime, 1.5, 3.5, "audio clock should keep running");
  assert(later.armedForAudioTime === armed.armedForAudioTime, "the armed chime moved, it should be fixed in advance");

  // The countdown is derived from the wall clock, so it must have moved by about two seconds.
  assertInRange((await state()).remainingMs, 27500, 28500, "countdown should be ~28s left");
});

await check("pause holds the remaining time, resume continues, reset restores", async () => {
  await page.click("#start"); // pause
  await waitForPhase("paused");
  const paused = await state();
  assert((await audio()).armed === false, "pausing should drop the armed chime");

  await page.waitForTimeout(1200);
  assert((await state()).remainingMs === paused.remainingMs, "the countdown moved while paused");

  await page.click("#start"); // resume
  await waitForPhase("running");
  const resumed = await audio();
  assert(resumed.armed === true, "resuming should re-arm the chime");
  assertInRange(
    resumed.armedForAudioTime - resumed.audioTime,
    paused.remainingMs / 1000 - 1.5,
    paused.remainingMs / 1000 + 0.5,
    "chime should be re-armed for the remaining time",
  );

  await page.click("#reset");
  await waitForPhase("idle");
  const reset = await state();
  assert(reset.remainingMs === 30000, "reset should restore the configured 30 seconds");
  assert((await text("#display")) === "00:30", "reset should restore 00:30 on the display");
  assert((await audio()).armed === false, "reset should not leave a chime armed");
});

await check("keyboard shortcuts control the timer", async () => {
  await page.click("h1"); // move focus off the buttons, the way a keyboard user would
  await page.keyboard.press("Space");
  await waitForPhase("running");
  await page.keyboard.press("Space");
  await waitForPhase("paused");
  await page.keyboard.press("r");
  await waitForPhase("idle");
  assert((await text("#display")) === "00:30", "reset should restore the display");
});

await check("completes with the visual alert, the reset display and a notification", async () => {
  await startTimer(0.05); // 3 seconds
  await waitForPhase("completed", 15000);

  assert((await text("#status")).includes("Time is up"), "status should announce completion");
  assert((await page.getAttribute("body", "data-phase")) === "completed", "body should show the completed phase");
  assert((await text("#display")) === "00:03", "the display should be reset to the configured time");
  assert((await text("#status")).includes("after 3 seconds"), "the status should name the finished duration");
  assert((await page.title()) === "Time is up!", "the tab title should flash");

  const done = await diagnostics();
  assert(done.lastCompletion.lateByMs < 1500, `completion was late by ${done.lastCompletion.lateByMs}ms`);
  assert(done.lastCompletion.chimeWasArmed === true, "the chime should have been armed before completion");
  assert(done.lastCompletion.chimeSounded === true, "the armed chime should have sounded by completion time");
  assert(done.keepAliveHeld === false, "the web lock should be released at completion");
  assert(done.lastNotification.shown === true, `notification should be shown, got ${JSON.stringify(done.lastNotification)}`);
  await page.click("#reset");
  await waitForPhase("idle");
});

await check("explains a denied notification permission instead of failing", async () => {
  const deniedPage = await context.newPage();
  await deniedPage.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "denied" });
    Notification.requestPermission = async () => "denied";
  });
  await deniedPage.goto(`${origin}${PAGE}`);
  await deniedPage.fill("#minutes", "1");
  await deniedPage.click("#start");
  await deniedPage.waitForFunction(() => window.__pomodoro.timer.snapshot().phase === "running");

  const notice = await deniedPage.textContent("#permission-notice");
  assert(notice.includes("blocked"), `expected a blocked notification notice, got "${notice}"`);
  assert(notice.includes("Site settings"), "the notice should say how to allow notifications");
  await deniedPage.close();
});

await check("a hidden tab keeps time and catches up when it comes back", async () => {
  const cdp = await context.newCDPSession(page);
  await startTimer(1);
  const before = await state();

  try {
    await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await cdp.send("Page.setWebLifecycleState", { state: "active" });
  } catch (error) {
    console.log(`\n(freeze half of this check skipped: ${error.message.split("\n")[0]})`);
  }

  await page.bringToFront();
  await page.waitForTimeout(600);
  const after = await state();
  assert(after.phase === "running", "the timer should still be running after the tab came back");
  assert(after.remainingMs < before.remainingMs, "the countdown should have moved on while the tab was away");
  assert(after.remainingMs > 50000, `the countdown jumped too far: ${after.remainingMs}ms left`);

  const rearmed = await audio();
  assert(rearmed.armed === true, "the chime should still be armed after coming back");
  assertInRange(
    rearmed.armedForAudioTime - rearmed.audioTime,
    after.remainingMs / 1000 - 1.5,
    after.remainingMs / 1000 + 1.5,
    "the re-armed chime should sit at the countdown that is left",
  );
  await page.click("#reset");
  await waitForPhase("idle");
});

await check("test chime unlocks audio on demand", async () => {
  const freshPage = await context.newPage();
  await freshPage.goto(`${origin}${PAGE}`);
  await freshPage.click("#test");
  await freshPage.waitForFunction(() => window.__pomodoro.player.status().unlocked === true, null, { timeout: 5000 });

  const status = await freshPage.evaluate(() => window.__pomodoro.player.status());
  assert(status.unlocked === true, `audio should be unlocked, got ${JSON.stringify(status)}`);
  const message = await freshPage.textContent("#status");
  assert(message.includes("Test chime played"), `unexpected status: ${message}`);
  await freshPage.close();
});

await check("made no network requests during the whole run", async () => {
  assert(requests.length === 1, `expected only the page request, saw: ${requests.join(", ")}`);
  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(" | ")}`);
});

await browser.close();
server.close();

console.log(results.join("\n"));
console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
