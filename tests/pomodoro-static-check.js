const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "pomodoro-timer.html");
const html = fs.readFileSync(htmlPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(!/<script\s+src=/i.test(html), "app must keep JavaScript inline");
assert(!/<link\s+[^>]*stylesheet/i.test(html), "app must keep CSS inline");
assert(/<style>[\s\S]*<\/style>/.test(html), "missing embedded CSS");

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/i);
assert(scriptMatch, "missing embedded script");
new Function(scriptMatch[1]);

[
  "AudioContext",
  "webkitAudioContext",
  "Notification.requestPermission",
  "visibilitychange",
  "wakeLock",
  "Worker",
  "role=\"timer\"",
  "aria-live=\"polite\"",
  "min=\"1\"",
  "max=\"999\"",
  "step=\"1\"",
  "Date.now()",
  "beforeunload"
].forEach((token) => {
  assert(html.includes(token), `missing required token: ${token}`);
});

console.log("pomodoro static checks OK");
