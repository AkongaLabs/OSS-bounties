# Pomodoro timer prototype (bounty #1)

`index.html` is the entire application: one HTML file, embedded CSS and JavaScript, no build
step, no dependencies, and not a single network request at runtime (the chime is synthesised
locally, the icon is an inline SVG). It was written for recent Chrome desktop, and it also
runs from `file://`.

## Run it

```bash
# option 1: just open it
start pomodoro/index.html

# option 2: over http (needed for notifications on some Chrome setups)
cd pomodoro
bun run serve          # then open http://localhost:4173/
```

## Using it

| Control | What it does |
| --- | --- |
| Minutes | 1 second to 999 minutes. Decimals are allowed: `0.5` = 30 seconds, `0.05` = 3 seconds. The input's floor is one second rather than one minute because the bounty's own test plan starts with a 30 second timer. |
| Start / Pause / Resume | Same button, label follows the state. Also `Space`. |
| Reset | Back to the configured time, stops the run. Also `R`. |
| Test chime | Unlocks audio and rings the chime immediately, without disturbing a running timer. |

The status line always says what just happened: running, paused with time left, or time is up.

## How background audio actually works

This is the part that decides the bounty, so the design is deliberate. Two browser behaviours
make the naive implementation fail:

- Chrome will not start audio until the page has been clicked (autoplay policy), so a page that
  only touches audio at 00:00 can stay silent forever.
- Chrome throttles JavaScript timers in hidden tabs to once a second, and to **once a minute**
  after five minutes hidden ("intensive throttling"). A chime set with `setTimeout(remainingMs)`
  therefore fires arbitrarily late, or not at all if the tab was discarded.

Instead of fighting those, the prototype moves the timing problem off the main thread:

1. **Unlock once, on a click.** The `AudioContext` is created and resumed inside the click that
   starts the timer, and a `statechange` listener keeps the UI honest if audio is suspended later.
2. **Arm the chime for the exact end time, on the audio clock.** `oscillator.start(ctx.currentTime + remainingSeconds)`
   schedules the whole three-note chime in advance. Audio rendering happens on the audio thread,
   which keeps its own clock, so the sound is emitted at the requested instant no matter what the
   page's JavaScript timers are doing. The countdown can be throttled; the chime cannot.
3. **Never accumulate time.** Every tick recomputes the remaining time from `Date.now()` against
   an absolute deadline, so a late, coalesced or skipped tick cannot make the clock drift — it
   only delays the next repaint. Throttling shows up as a stale display, never a wrong one.
4. **Catch up on every wake-up.** `visibilitychange`, `focus`, `pageshow` and the Page Lifecycle
   `resume` event all recompute the remaining time and re-arm the chime if it is not armed.
   That covers the case where audio was unlocked or resumed in the middle of a run.
5. **Hold a Web Lock while running.** A held Web Lock is a signal that the page is still doing
   work, which browsers use when deciding whether to freeze or discard a hidden tab.
6. **Report the difference.** If Chrome wakes the tab late, the completion is late (the status
   line and the console say by how much), but the chime already rang on time. That distinction is
   the whole point of the design: sound on time, pixels whenever the browser allows.

The console logs one line per decision (`[pomodoro] chime armed for audio time 1500.000s, ...`),
so a reviewer can see exactly what happened without reading the source.

## Degradation ladder

The timer never depends on any single alert mechanism:

1. Chime armed on the audio clock (normal path).
2. Chime played immediately if nothing was armed when the countdown finished (audio was blocked).
3. Desktop notification (`Time is up`, `requireInteraction`, click focuses the tab) if allowed.
4. Flashing tab title, green completion state and a status line — always, and visible while the
   page is hidden but still in the same window.

If sound is blocked, an inline notice explains how to allow it (padlock icon → Site settings →
Sound → Allow) instead of failing silently. Notifications are optional and explained the same way.

## Decisions a reviewer might question

- **The display returns to the configured time at 00:00**, because the brief asks for exactly
  that. The completed state stays obvious: green display, border flash, `Time is up:` status and
  a flashing tab title, so a reset is never mistaken for an idle timer.
- **The display rounds up, the countdown does not.** `formatClock` uses `ceil`, so a 30 second
  timer reads `00:30` at the start and `00:00` only when it is over; the underlying remaining
  time stays in milliseconds.
- **Reset and Test chime are the only controls added to the brief.** No break timer, no cycle
  tracking, no persistence: single repeating timer, as specified.
- **The one deviation from the brief's numbers: the minutes floor is 1 second, not 1 minute.**
  The brief also asks for a 30 second background-audio test, which is unreachable if a whole
  minute is the minimum; so `0.5` = 30 seconds, `1` = 1 minute and `999` is the stated maximum.
  Invalid values still get a message naming the limit ("Enter at least 1 second, for example 0.5
  for 30 seconds").
- **Editing the minutes field mid-run does not touch the current run**; the new value applies to
  the next one. Changing it while idle or completed moves the displayed time immediately.
- **A short error message rather than `alert()`:** the field gets `aria-invalid`, the message is
  announced through `role="alert"`, and focus returns to the input.
- **Zero dependencies.** Tests use Bun's built-in runner; the optional browser check uses
  Playwright as a dev dependency only. The app itself ships no dependency at all.

## Accessibility

- Native `<input>` and `<button>` elements only, so Tab order is the document order.
- `Space` starts or pauses when the page has focus; when a button has focus, `Space` activates
  that button as usual. `R` resets. The shortcuts are listed in the page itself.
- The countdown is `role="timer"` with a static `aria-label` and `aria-live="off"`; announcements
  happen on the status line (`role="status"`), which is written once per state change instead of
  once per second. Input errors use `role="alert"`.
- Visible `:focus-visible` outlines, high contrast palettes for light and dark mode, and
  `prefers-reduced-motion` disables the completion flash and the progress transition.

## Files

```
pomodoro/
├── index.html                     the whole app (single file, zero dependencies)
├── package.json                   bun test / bun run e2e / bun run screenshots / bun run serve
├── README.md                      this file
├── TESTING.md                     how to reproduce every check, including the manual ones
├── docs/
│   ├── browser-limitations.md     what Chrome does and how the app responds
│   └── screenshots/               captured from the run below, used as submission evidence
└── tests/
    ├── timer.test.js              53 bun tests: timer, chime scheduling, validation, messages
    ├── core-extract.js            pulls the shipped logic block out of index.html
    ├── audio-mock.js              recording Web Audio stand-in used by the tests
    ├── static-server.js           tiny server plus browser launcher for the checks below
    ├── chrome-e2e.js              10 checks in installed Chrome
    └── screenshots.js             regenerates docs/screenshots/
```

## Verify it yourself

```bash
cd pomodoro
bun test                      # 53 tests, no install needed
bun run e2e                   # optional: 10 checks in the Chrome already on your machine,
                              # needs `bun add -d playwright` once
```

Manual protocol, including the background-tab check, is in [TESTING.md](TESTING.md).
