const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("pomodoro-timer.html", "utf8");

const requiredSnippets = [
  "role=\"timer\"",
  "AudioContext",
  "Notification.requestPermission",
  "Date.now()",
  "visibilitychange",
  "window.pomodoroTestApi",
];

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`Missing required snippet: ${snippet}`);
  }
}

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
  throw new Error("Expected embedded JavaScript");
}

const elements = new Map();

function createElement(selector) {
  const element = {
    dataset: {},
    disabled: false,
    textContent: "",
    value: selector === "#minutes" ? "25" : "",
    addEventListener() {},
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  elements.set(selector, element);
  return element;
}

const context = {
  console,
  window: {
    setInterval: () => 1,
    clearInterval() {},
    addEventListener() {},
  },
  document: {
    querySelector(selector) {
      return elements.get(selector) || createElement(selector);
    },
    addEventListener() {},
  },
  Notification: {
    permission: "denied",
    requestPermission: async () => "denied",
  },
};

context.window.window = context.window;
context.window.document = context.document;
context.window.Notification = context.Notification;
context.window.Date = Date;
context.window.Math = Math;
context.window.Number = Number;
context.window.String = String;
context.window.Error = Error;

vm.runInNewContext(scriptMatch[1], context.window);

const api = context.window.pomodoroTestApi;
if (!api) {
  throw new Error("Expected pomodoroTestApi to be available");
}

if (api.formatTime(65) !== "01:05") {
  throw new Error("formatTime should render MM:SS");
}

elements.get("#minutes").value = "0";
try {
  api.readDuration();
  throw new Error("readDuration should reject 0 minutes");
} catch (error) {
  if (!String(error.message).includes("1 to 999")) {
    throw error;
  }
}

elements.get("#minutes").value = "30";
if (api.readDuration() !== 1800) {
  throw new Error("readDuration should convert minutes to seconds");
}

console.log("Smoke test passed");
