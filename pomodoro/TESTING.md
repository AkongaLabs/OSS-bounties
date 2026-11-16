# Testing notes

Everything below can be reproduced on a clean checkout. Three layers:

1. `bun test` — 53 tests over the logic that ships inside `index.html` (no browser, no install).
2. `bun run e2e` — 10 checks in the Chrome already installed on the machine (one dev dependency).
3. The manual protocol at the bottom, which is the only way to prove the audio itself.

## 1. Automated tests

```bash
cd pomodoro
bun test
```

```
53 pass
0 fail
```

`tests/core-extract.js` lifts the `/*<core-logic>*/` block out of the shipped `index.html` and
evaluates it, so the tests exercise the real file rather than a copy that can drift. The suite
covers the critical flows:

| Area | What is asserted |
| --- | --- |
| Input validation | `1`, `25`, ` 25 `, `999`, `1.23`, `+5`, `0.5` (the bounty's 30 second case) accepted; empty, `0`, `0.016`, `-5`, `1000`, `abc`, `2x`, `1,5`, `NaN`, `Infinity`, `1e3` rejected with a readable message that names the limit. |
| Clock | MM:SS formatting, no negative time, `00:00` only when the timer is over, 999 minutes. |
| Timer | Countdown from the wall clock, no drift with irregular or coalesced ticks, pause/resume, reset, reconfiguration between runs, completion exactly at the deadline, `lateByMs` reporting, no double completion. |
| Background audio | Audio locked until a click, resume of a suspended context, refusal handling, no `AudioContext` at all, whole run armed in advance on the audio clock, arming when audio is unlocked mid-run, 25 minute arm time, no drift with a 45 second late wake-up, one ring and not two, pause cancels and re-arms, test chime leaves the pending chime alone, delivery after a frozen audio clock, cancelled graphs are stopped. |
| Keep alive | Web Lock is requested on start, released on stop, and absence of the API is tolerated. |
| Messages | The notice text for every audio and notification state, including the "denied, then allowed later" path. |
| Packaging | `index.html` contains no external `src`/`href`, no `url()`, no `fetch`, no `serviceWorker`, no absolute URL. |

## 2. Browser test (optional)

Needs Playwright, which is a dev dependency only — the app never loads it. It drives the Chrome
already installed on the machine, so nothing is downloaded beyond the small Playwright package;
it falls back to Edge and then to Playwright's own Chromium.

```bash
cd pomodoro
bun add -d playwright
bun run e2e
```

```
Using installed Google Chrome (157.0.8103.79).
PASS  loads as a single page with no external requests
PASS  rejects invalid minutes and explains why
PASS  the chime is armed on the audio clock, in advance
PASS  pause holds the remaining time, resume continues, reset restores
PASS  keyboard shortcuts control the timer
PASS  completes with the visual alert, the reset display and a notification
PASS  explains a denied notification permission instead of failing
PASS  a hidden tab keeps time and catches up when it comes back
PASS  test chime unlocks audio on demand
PASS  made no network requests during the whole run

10 passed, 0 failed
```

It drives the real page: validation errors, start/pause/resume/reset, keyboard shortcuts, the
notification path including a simulated denial, a frozen tab through the DevTools protocol, and
the audio-clock proof that the armed chime's start time is fixed in advance while the countdown
keeps moving.

`bun run screenshots` regenerates `docs/screenshots/` from the same setup.

## 3. Manual protocol (the part that decides the bounty)

Run this in Chrome desktop, over `http://localhost:4173/` (`bun run serve`) or straight from
`file://`. Open DevTools → Console: the app logs its audio decisions.

| # | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| 1 | Background audio | Type `0.5` → Start → switch to another tab or minimise the window and wait 30s | Chime rings at 30s while the tab is hidden. Console shows the chime was armed and never re-scheduled. |
| 2 | Long-run throttle | Type `7` → Start → switch away for 7 minutes (or `6` if you are impatient) | Chime rings on time. On return, the display catches up to the correct value. If Chrome woke the tab late, the status line says so and the console reports `noticed <n>ms after the deadline`. |
| 3 | Notification permission: allowed | Fresh profile → Start → **Allow** notifications → let the timer finish | Desktop notification "Time is up", tab title flashes, status line and green completion state. |
| 4 | Permission: denied | Load a fresh profile → Start → **Block** notifications → let the timer finish | Chime still rings, title still flashes, notice explains where to allow notifications later. Nothing throws. |
| 5 | Denied, then allowed | Continue from 4 → padlock icon → Site settings → Notifications → Allow → Start a new timer | The warning disappears without a reload and the next completion notifies. |
| 6 | Sound blocked (mute) | Right-click the tab → Mute site (or deny sound for the origin) → Start a run | Notice: "Chrome is blocking sound for this page. Press Test chime once…". Timer, notification and visuals are unaffected. |
| 7 | Audio suspended | Leave a run paused for several minutes, then resume | If Chrome suspended the context, the notice says so and Test chime wakes it; the completion chime is re-armed when audio returns. |
| 8 | Tab inactive accuracy | Type `1` → Start → switch away 30s → come back | Display is correct within a second of returning (throttling delays repaint, never the clock). |
| 9 | Input validation | Try `0`, `-5`, `abc`, empty, `1000` | Inline error under the field, red border, focus returns to the field, no run starts. |
| 10 | Decimals | Type `0.5` → Start | 30 second timer, display `00:30`. |
| 11 | Keyboard | Tab through the controls; then `Space`, `Space`, `R` | Focus ring on each control; Space starts, Space pauses, R resets. With a button focused, Space activates that button. |
| 12 | Screen reader | NVDA or VoiceOver: start and finish a run | State changes are announced once (status line); the countdown is not announced every second. |

### Notes from running this

- Chrome's hidden-tab throttling is visible in the console: the `[pomodoro] timer finished: …
  noticed <n>ms after the deadline` line stays near zero for clicked-through runs of a few
  minutes and grows to seconds or a minute when the tab was hidden past the five minute mark.
  The chime is unaffected either way, which is the point of scheduling it on the audio clock.
- The machine's own volume, "Do not disturb" and the per-tab mute button are the usual reason a
  chime "does not work". Scenario 6 exists because that mistake is easy to make; the app reports
  what it knows rather than pretending.
- Background audio cannot be proven by a headless browser, so scenarios 1, 2 and 7 are the ones
  worth re-running on the reviewer's machine. Steps 1 and 8 take under a minute.
