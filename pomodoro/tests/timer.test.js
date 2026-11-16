// Critical flow tests for the timer and for background audio, driven by the code that ships
// inside index.html. Run with `bun test`.
import { describe, expect, test } from "bun:test";

import { createAudioContextMock } from "./audio-mock.js";
import { loadCore } from "./core-extract.js";

const { html, core } = loadCore();

// createChimePlayer reads window.AudioContext, exactly as it does in the browser.
globalThis.window = globalThis.window ?? {};

function stubAudioContext(context) {
  globalThis.window.AudioContext = function AudioContextMock() {
    return context;
  };
}

describe("shipped file", () => {
  test("index.html is one self contained file with no network dependencies", () => {
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).toContain('<script type="module">');
    expect(html).toContain("/*<core-logic>*/");

    // Nothing may be fetched when the page opens: no external scripts, styles, fonts, icons
    // or media. Anything with a src or href has to be an inline data: URI, and the SVG
    // namespace of the inlined icon is the only URL-shaped string allowed.
    const referenced = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
    expect(referenced.filter((url) => !url.startsWith("data:"))).toEqual([]);

    const withoutSvgNamespace = html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
    expect(withoutSvgNamespace).not.toMatch(/@import|url\(|fetch\(|importScripts|serviceWorker|https?:\/\//i);
  });
});

describe("input validation", () => {
  const accepted = [
    ["1", 1, 60000],
    ["25", 25, 1500000],
    [" 25 ", 25, 1500000],
    ["999", 999, 59940000],
    ["1.23", 1.23, 73800],
    ["+5", 5, 300000],
    ["0.5", 0.5, 30000],
    ["0.017", 0.017, 1020],
  ];

  for (const [input, minutes, totalMs] of accepted) {
    test(`accepts ${JSON.stringify(input)}`, () => {
      const result = core.parseMinutes(input);
      expect(result.ok).toBe(true);
      expect(result.minutes).toBe(minutes);
      expect(result.totalMs).toBe(totalMs);
    });
  }

  // The bounty's own test plan starts with a 30 second timer, so sub-minute runs have to work.
  test("accepts the 30 second timer from the bounty test plan", () => {
    expect(core.parseMinutes("0.5")).toEqual({ ok: true, minutes: 0.5, totalMs: 30000 });
    expect(core.formatClock(core.parseMinutes("0.5").totalMs)).toBe("00:30");
  });

  const rejected = ["", "   ", "0", "0.016", "-5", "1000", "abc", "2x", "1,5", "NaN", "Infinity", "1e3"];

  for (const input of rejected) {
    test(`rejects ${JSON.stringify(input)} with a readable message`, () => {
      const result = core.parseMinutes(input);
      expect(result.ok).toBe(false);
      expect(result.message.length).toBeGreaterThan(10);
    });
  }

  test("names the limit it is refusing", () => {
    expect(core.parseMinutes("0.016").message).toContain("at least 1 second");
    expect(core.parseMinutes("1000").message).toContain("999 minutes");
  });

  test("treats a missing value as empty instead of crashing", () => {
    expect(core.parseMinutes(undefined).ok).toBe(false);
    expect(core.parseMinutes(null).ok).toBe(false);
  });
});

describe("clock formatting", () => {
  test("is MM:SS and never shows a negative time", () => {
    expect(core.formatClock(1500000)).toBe("25:00");
    expect(core.formatClock(59999)).toBe("01:00");
    expect(core.formatClock(59000)).toBe("00:59");
    expect(core.formatClock(0)).toBe("00:00");
    expect(core.formatClock(-4000)).toBe("00:00");
    expect(core.formatClock(59940000)).toBe("999:00");
  });

  test("reaches 00:00 only when the timer is over", () => {
    expect(core.formatClock(1)).toBe("00:01");
    expect(core.formatClock(0.5)).toBe("00:01");
  });
});

describe("timer", () => {
  function createHarness({ totalMs = 1500000, startAt = 1_000_000 } = {}) {
    let clock = startAt;
    const ticks = [];
    const completions = [];
    const timer = core.createTimer({
      now: () => clock,
      onTick: (snapshot) => ticks.push(snapshot),
      onComplete: (info) => completions.push(info),
    });
    timer.configure(totalMs);
    return {
      timer,
      ticks,
      completions,
      advance: (ms) => { clock += ms; },
      at: () => clock,
    };
  }

  test("starts idle at the configured time", () => {
    const h = createHarness();
    expect(h.timer.snapshot()).toEqual({ phase: "idle", configuredMs: 1500000, remainingMs: 1500000 });
  });

  test("counts down from the wall clock", () => {
    const h = createHarness();
    h.timer.start();
    h.advance(60000);
    expect(h.timer.tick().remainingMs).toBe(1440000);
    h.advance(59900);
    expect(h.timer.snapshot().remainingMs).toBe(1380100);
  });

  test("does not drift when ticks are irregular or coalesced", () => {
    const h = createHarness();
    h.timer.start();
    for (const step of [137, 1000, 4000, 250, 60000]) {
      h.advance(step);
      h.timer.tick();
    }
    // 65_387ms of clock time passed, so exactly that much must be gone from the countdown.
    expect(h.timer.snapshot().remainingMs).toBe(1500000 - 65387);
  });

  test("pause freezes the remaining time and resume continues from it", () => {
    const h = createHarness();
    h.timer.start();
    h.advance(30000);
    h.timer.pause();
    expect(h.timer.snapshot()).toEqual({ phase: "paused", configuredMs: 1500000, remainingMs: 1470000 });

    h.advance(120000); // time passes while paused
    expect(h.timer.snapshot().remainingMs).toBe(1470000);

    h.timer.start();
    h.advance(1000);
    expect(h.timer.snapshot().remainingMs).toBe(1469000);
  });

  test("start is refused with nothing configured and while already running", () => {
    const empty = core.createTimer();
    expect(empty.start()).toBe(false);

    const h = createHarness();
    expect(h.timer.start()).toBe(true);
    expect(h.timer.start()).toBe(false);
  });

  test("completes once, exactly at the deadline, and resets the display to the configured time", () => {
    const h = createHarness({ totalMs: 30000 });
    h.timer.start();

    h.advance(15000);
    h.timer.tick();
    expect(h.completions).toHaveLength(0);

    h.advance(15000); // lands exactly on the deadline
    const snapshot = h.timer.tick();

    expect(h.completions).toHaveLength(1);
    expect(h.completions[0]).toEqual({ lateByMs: 0, configuredMs: 30000 });
    expect(snapshot).toEqual({ phase: "completed", configuredMs: 30000, remainingMs: 30000 });
    expect(core.formatClock(snapshot.remainingMs)).toBe("00:30");

    // Further ticks must not fire the completion a second time.
    h.advance(5000);
    h.timer.tick();
    expect(h.completions).toHaveLength(1);
  });

  test("ignores a tick that arrives just before the deadline", () => {
    const h = createHarness({ totalMs: 1000 });
    h.timer.start();
    h.advance(999);
    expect(h.timer.tick().phase).toBe("running");
    expect(h.completions).toHaveLength(0);
  });

  test("reports how late a throttled tab noticed the deadline", () => {
    const h = createHarness({ totalMs: 30000 });
    h.timer.start();
    h.advance(30000 + 45000); // Chrome only woke the tab 45s after the deadline
    const snapshot = h.timer.tick();

    expect(h.completions[0].lateByMs).toBe(45000);
    expect(snapshot.phase).toBe("completed");
  });

  test("reset returns to idle with the configured time and drops the deadline", () => {
    const h = createHarness();
    h.timer.start();
    h.advance(45000);
    h.timer.reset();
    expect(h.timer.snapshot()).toEqual({ phase: "idle", configuredMs: 1500000, remainingMs: 1500000 });

    h.advance(3600000);
    expect(h.timer.snapshot().remainingMs).toBe(1500000);
    expect(h.completions).toHaveLength(0);
  });

  test("reconfiguring for the next run does not leave the previous deadline behind", () => {
    const h = createHarness({ totalMs: 30000 });
    h.timer.start();
    h.advance(29999);
    h.timer.configure(60000);
    expect(h.timer.snapshot()).toEqual({ phase: "idle", configuredMs: 60000, remainingMs: 60000 });

    h.timer.start();
    h.advance(59999);
    expect(h.timer.tick().phase).toBe("running");
    h.advance(1);
    expect(h.timer.tick().phase).toBe("completed");
    expect(h.completions).toHaveLength(1);
  });
});

describe("background audio", () => {
  // Wires the same objects the page wires: timer, chime player and the keep alive lock.
  // advance() moves both clocks, because that is what a throttled tab looks like: the wall
  // clock and the audio clock keep going while the JavaScript callbacks do not.
  function createRun({ totalMs = 1500000, context = createAudioContextMock() } = {}) {
    stubAudioContext(context);

    const player = core.createChimePlayer();
    let clock = 1_000_000;
    const completions = [];

    const timer = core.createTimer({
      now: () => clock,
      onComplete: (info) => {
        const chimeWasArmed = player.isArmed();
        const chimeSounded = player.hasSounded();
        if (chimeSounded) player.cancel();
        else if (!chimeWasArmed) player.playNow();
        completions.push({ ...info, chimeWasArmed, chimeSounded });
      },
    });
    timer.configure(totalMs);

    return {
      audioContext: context,
      player,
      timer,
      completions,
      ensureChimeScheduled: () => {
        if (timer.snapshot().phase !== "running" || player.isArmed()) return player.isArmed();
        return player.schedule(timer.snapshot().remainingMs);
      },
      advance: (ms) => {
        clock += ms;
        context.currentTime += ms / 1000;
      },
      advanceWallOnly: (ms) => { clock += ms; },
      advanceAudioOnly: (seconds) => { context.currentTime += seconds; },
    };
  }

  test("audio starts out locked and the context is created on the first click", async () => {
    const run = createRun();
    expect(run.player.status()).toEqual({ supported: true, unlocked: false, contextState: "none" });

    expect(await run.player.unlock()).toBe(true);
    expect(run.player.status()).toEqual({ supported: true, unlocked: true, contextState: "running" });
  });

  test("a suspended context is resumed on the user's click", async () => {
    const context = createAudioContextMock({ state: "suspended" });
    const run = createRun({ context });

    expect(await run.player.unlock()).toBe(true);
    expect(context.resumeCalls).toBe(1);
    expect(run.player.status().unlocked).toBe(true);
  });

  test("a context that refuses to resume reports itself as locked", async () => {
    const context = createAudioContextMock({ state: "suspended", resumable: false });
    stubAudioContext(context);
    const player = core.createChimePlayer();

    expect(await player.unlock()).toBe(false);
    expect(player.status()).toEqual({ supported: true, unlocked: false, contextState: "suspended" });
  });

  test("no audio support is reported instead of throwing", async () => {
    globalThis.window.AudioContext = undefined;
    globalThis.window.webkitAudioContext = undefined;
    const player = core.createChimePlayer();

    expect(player.status().supported).toBe(false);
    expect(await player.unlock()).toBe(false);
    expect(player.schedule(1000)).toBe(false);
    expect(player.playNow()).toBe(false);
  });

  test("the whole timer is armed in advance on the audio clock, not by a JavaScript timer", async () => {
    const run = createRun({ totalMs: 1500000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();

    expect(run.player.isArmed()).toBe(true);
    expect(run.player.hasSounded()).toBe(false);
    expect(run.player.debug().armedForAudioTime).toBe(1500); // 25 minutes, in audio time

    // Every note of the three note chime has its absolute start time on the audio clock.
    const starts = run.audioContext.oscillators.map((oscillator) => oscillator.startedAt);
    expect(starts).toEqual(core.CHIME_NOTES.map((note) => 1500 + note.offsetSeconds));
  });

  test("the chime is armed even when audio was only unlocked later", async () => {
    const run = createRun({ totalMs: 60000 });
    run.timer.start();
    expect(run.player.isArmed()).toBe(false); // nothing is armed while audio is locked

    await run.player.unlock(); // the user clicks Test chime halfway through
    run.advance(30000);
    run.ensureChimeScheduled();

    expect(run.player.isArmed()).toBe(true);
    expect(run.player.debug().armedForAudioTime).toBe(60); // still the original deadline
    expect(run.completions).toHaveLength(0);
  });

  test("the sound still happens when JavaScript is throttled to one wake up per minute", async () => {
    const run = createRun({ totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();

    // The page is hidden for the whole run; Chrome delays the timer callback by 45 seconds,
    // while both clocks keep running.
    run.advance(30000 + 45000);
    run.timer.tick();

    expect(run.completions).toHaveLength(1);
    expect(run.completions[0].lateByMs).toBe(45000);
    expect(run.completions[0].chimeWasArmed).toBe(true);
    expect(run.completions[0].chimeSounded).toBe(true); // it rang at 30s, not at 75s
    expect(run.audioContext.oscillators[0].startedAt).toBe(30);
  });

  test("a throttled tab rings once, not twice, at completion", async () => {
    const run = createRun({ totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();
    const graphsAfterStart = run.audioContext.oscillators.length;

    run.advance(30000 + 45000);
    run.timer.tick();
    run.timer.tick();
    run.ensureChimeScheduled();

    expect(run.completions).toHaveLength(1);
    expect(run.audioContext.oscillators.length).toBe(graphsAfterStart); // no extra chime was played
  });

  test("pausing and resuming moves the pending chime with the timer", async () => {
    const run = createRun({ totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();

    run.advance(10000);
    run.timer.pause();
    run.player.cancel(); // what the page does on pause
    expect(run.player.isArmed()).toBe(false);

    run.advance(60000); // paused for a minute
    run.timer.start();
    run.ensureChimeScheduled();
    expect(run.player.debug().armedForAudioTime).toBe(90); // 70s of audio time elapsed, 20s left
  });

  test("the test chime plays immediately without dropping the pending one", async () => {
    const run = createRun({ totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();
    const oscillatorsBefore = run.audioContext.oscillators.length;

    expect(run.player.playNow()).toBe(true);
    expect(run.audioContext.oscillators.length).toBe(oscillatorsBefore + core.CHIME_NOTES.length);
    expect(run.player.debug().armedForAudioTime).toBe(30); // the real chime is untouched
  });

  test("audio that comes back after the deadline still delivers the armed chime", async () => {
    const context = createAudioContextMock();
    const run = createRun({ context, totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();

    run.advanceWallOnly(30000); // the wall clock reaches the deadline while the audio clock is frozen
    expect(run.player.hasSounded()).toBe(false);

    run.advanceAudioOnly(30); // audio resumes: the armed chime is delivered then
    expect(run.player.hasSounded()).toBe(true);
  });

  test("each run gets its own chime graph and cancelled ones are stopped", async () => {
    const run = createRun({ totalMs: 30000 });
    await run.player.unlock();
    run.timer.start();
    run.ensureChimeScheduled();

    const firstRun = run.audioContext.oscillators.slice();
    run.player.cancel();
    run.ensureChimeScheduled();

    expect(run.audioContext.oscillators.length).toBe(firstRun.length * 2);
    for (const oscillator of firstRun) expect(oscillator.stopCalls.length).toBeGreaterThan(0);
  });
});

describe("keep alive", () => {
  test("a running timer holds a web lock and releases it", async () => {
    const held = [];
    const released = [];
    const navigatorLike = {
      locks: {
        request(name, callback) {
          held.push(name);
          const promise = callback();
          return promise.then(() => released.push(name));
        },
      },
    };

    const release = core.holdKeepAlive(navigatorLike);
    expect(held).toEqual(["pomodoro-timer-running"]);

    release();
    await Promise.resolve();
    expect(released).toEqual(["pomodoro-timer-running"]);
  });

  test("browsers without the Web Locks API are tolerated", () => {
    expect(() => core.holdKeepAlive({})()).not.toThrow();
    expect(() => core.holdKeepAlive(undefined)()).not.toThrow();
  });
});

describe("messages", () => {
  test("audio problems are explained with a fix", () => {
    expect(core.audioNoticeMessage({ supported: true, unlocked: true, contextState: "running", attempted: true })).toBe(null);
    expect(core.audioNoticeMessage({ supported: true, unlocked: false, contextState: "none", attempted: false })).toBe(null);

    const blocked = core.audioNoticeMessage({ supported: true, unlocked: false, contextState: "suspended", attempted: true });
    expect(blocked.kind).toBe("warning");
    expect(blocked.text).toContain("Test chime");
    expect(blocked.text).toContain("keeps working without sound");

    const unsupported = core.audioNoticeMessage({ supported: false, unlocked: false, contextState: "none", attempted: true });
    expect(unsupported.kind).toBe("error");

    const suspendedLater = core.audioNoticeMessage({ supported: true, unlocked: true, contextState: "suspended", attempted: true });
    expect(suspendedLater.text).toContain("suspended");
  });

  test("notification permissions are explained for every state", () => {
    expect(core.notificationNoticeMessage({ supported: true, permission: "granted" })).toBe(null);
    expect(core.notificationNoticeMessage({ supported: true, permission: "default" }).kind).toBe("info");

    const denied = core.notificationNoticeMessage({ supported: true, permission: "denied" });
    expect(denied.kind).toBe("warning");
    expect(denied.text).toContain("Site settings");

    expect(core.notificationNoticeMessage({ supported: false, permission: "unsupported" }).kind).toBe("warning");
  });

  test("the completion notification names the timer that finished", () => {
    expect(core.notificationPayload({ configuredMs: 30000 })).toEqual({
      title: "Time is up",
      body: "Timer finished after 30 seconds.",
      tag: "pomodoro-timer",
    });
    expect(core.notificationPayload({ configuredMs: 1500000 }).body).toBe("Timer finished after 25 minutes.");
    expect(core.notificationPayload({ configuredMs: 60000 }).body).toBe("Timer finished after 1 minute.");
    expect(core.notificationPayload({ configuredMs: 1000 }).body).toBe("Timer finished after 1 second.");
  });
});
