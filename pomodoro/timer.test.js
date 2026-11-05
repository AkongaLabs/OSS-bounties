import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "pomodoro.html"), "utf8");
const coreSource = html.match(/<script id="pomodoro-core">([\s\S]*?)<\/script>/)[1];
const sandbox = {};
createContext(sandbox);
new Script(coreSource).runInContext(sandbox);
const core = sandbox.PomodoroCore;

const minute = 60 * 1000;

describe("minutes validation", () => {
  test("accepts whole minutes from 1 to 999, including surrounding spaces", () => {
    expect(core.validateMinutes("25")).toEqual({ ok: true, code: "ok", minutes: 25, message: "" });
    expect(core.validateMinutes(" 1 ")).toMatchObject({ ok: true, minutes: 1 });
    expect(core.validateMinutes("999")).toMatchObject({ ok: true, minutes: 999 });
    expect(core.validateMinutes("007")).toMatchObject({ ok: true, minutes: 7 });
  });

  test("rejects empty, negative, decimal, zero, huge, and non-numeric values", () => {
    expect(core.validateMinutes("")).toMatchObject({ ok: false, code: "empty" });
    expect(core.validateMinutes("   ")).toMatchObject({ ok: false, code: "empty" });
    expect(core.validateMinutes(null)).toMatchObject({ ok: false, code: "empty" });
    expect(core.validateMinutes("-1").message).toContain("negative");
    expect(core.validateMinutes("-1.5").code).toBe("negative");
    expect(core.validateMinutes("1.5").code).toBe("decimal");
    expect(core.validateMinutes("0.5").code).toBe("decimal");
    expect(core.validateMinutes("0").code).toBe("zero");
    expect(core.validateMinutes("000").code).toBe("zero");
    expect(core.validateMinutes("1000").code).toBe("too-big");
    expect(core.validateMinutes("999999999999999999999").code).toBe("too-big");
    expect(core.validateMinutes("abc").code).toBe("nan");
    expect(core.validateMinutes("1e2").code).toBe("nan");
    expect(core.validateMinutes("+5").code).toBe("nan");
    expect(core.validateMinutes("12 minutes").code).toBe("nan");
  });
});

describe("clock display", () => {
  test("formats remaining time as minutes and seconds, rounding up partial seconds", () => {
    expect(core.formatClock(25 * minute)).toBe("25:00");
    expect(core.formatClock(minute)).toBe("01:00");
    expect(core.formatClock(59000)).toBe("00:59");
    expect(core.formatClock(59001)).toBe("01:00");
    expect(core.formatClock(1)).toBe("00:01");
    expect(core.formatClock(0)).toBe("00:00");
    expect(core.formatClock(999 * minute)).toBe("999:00");
    expect(core.spokenRemaining(150 * 1000)).toBe("2 minutes 30 seconds remaining");
    expect(core.spokenRemaining(60 * 1000)).toBe("1 minute 0 seconds remaining");
    expect(core.spokenRemaining(1000)).toBe("0 minutes 1 second remaining");
  });
});

describe("session timing", () => {
  test("start, pause, resume, and completion follow the wall clock and reset the display", () => {
    let session = core.idleSession(minute);
    session = core.reduce(session, { type: "start", now: 1_000 });
    expect(session).toMatchObject({ phase: "running", remainingMs: minute, endsAt: 1_000 + minute });

    const ignored = core.reduce(session, { type: "start", now: 5_000 });
    expect(ignored.endsAt).toBe(session.endsAt);

    session = core.reduce(session, { type: "tick", now: 1_000 + 20_000 });
    expect(session).toMatchObject({ phase: "running", remainingMs: 40_000, endsAt: 1_000 + minute });

    session = core.reduce(session, { type: "pause", now: 1_000 + 20_000 });
    expect(session).toMatchObject({ phase: "paused", remainingMs: 40_000, endsAt: null });

    const held = core.reduce(session, { type: "set-duration", durationMs: 5 * minute });
    expect(held.durationMs).toBe(minute);

    session = core.reduce(session, { type: "start", now: 80_000 });
    expect(session).toMatchObject({ phase: "running", remainingMs: 40_000, endsAt: 120_000 });

    session = core.reduce(session, { type: "tick", now: 120_000 });
    expect(session).toMatchObject({ phase: "done", remainingMs: minute, endsAt: null });
    expect(core.formatClock(session.remainingMs)).toBe("01:00");
    expect(core.audioDelaySeconds(40_000)).toBe(40);
    expect(core.progress(session)).toBe(1);
  });

  test("a finished session starts a full new run, and escape cancels back to the configured length", () => {
    let session = core.reduce(core.idleSession(2 * minute), { type: "start", now: 0 });
    session = core.reduce(session, { type: "tick", now: 2 * minute });
    expect(session.phase).toBe("done");
    session = core.reduce(session, { type: "start", now: 9_000 });
    expect(session).toMatchObject({ phase: "running", remainingMs: 2 * minute, endsAt: 9_000 + 2 * minute });

    session = core.reduce(session, { type: "pause", now: 9_000 + minute });
    session = core.reduce(session, { type: "cancel" });
    expect(session).toMatchObject({ phase: "idle", remainingMs: 2 * minute, endsAt: null });
  });

  test("editing minutes only changes an idle or finished session", () => {
    let session = core.idleSession(minute);
    session = core.reduce(session, { type: "set-duration", durationMs: 5 * minute });
    expect(session).toMatchObject({ phase: "idle", durationMs: 5 * minute, remainingMs: 5 * minute });
    session = core.reduce(session, { type: "tick", now: 0 });
    expect(session.phase).toBe("idle");
  });
});

describe("permission guidance", () => {
  test("blocked sound and denied notifications include Chrome settings paths", () => {
    const blocked = core.guidance({ audio: "blocked", notifications: "denied" });
    expect(blocked.showAudioHelp).toBe(true);
    const text = blocked.steps.join(" ");
    expect(text).toContain("chrome://settings/content/sound");
    expect(text).toContain("chrome://settings/content/notifications");
    expect(text).toContain("countdown keeps running");
  });

  test("a first visit explains the notification prompt without calling sound blocked", () => {
    const first = core.guidance({ audio: "unknown", notifications: "default" });
    expect(first.showAudioHelp).toBe(false);
    expect(first.steps.join(" ")).toContain("another tab");
  });
});

describe("single file deliverable", () => {
  test("the page inlines css and javascript and does not load external assets", () => {
    expect(html.includes('id="pomodoro-core"')).toBe(true);
    expect(html.includes("<style>")).toBe(true);
    expect(/<script[^>]+src=/.test(html)).toBe(false);
    expect(/<link[^>]+stylesheet/.test(html)).toBe(false);
    expect(/url\(\s*['"]?https?:/.test(html)).toBe(false);
    expect(/<(?:img|script)[^>]+src=["']https?:/.test(html)).toBe(false);
    expect(/<link[^>]+href=["']https?:/.test(html)).toBe(false);
  });
});
