# Single-file Pomodoro timer

`index.html` is the complete application: inline CSS/JavaScript, no downloads,
dependencies, accounts, database or environment variables. It implements
[issue #1](https://github.com/AkongaLabs/OSS-bounties/issues/1). The issuer
[explicitly confirmed the single-file approach](https://github.com/AkongaLabs/OSS-bounties/issues/1#issuecomment-2994897011).

## Run

Open `index.html` in recent desktop Chrome. For a local HTTP demo, with Bun
already available:

```sh
cd solutions/pomodoro
bun run dev
```

Visit `http://127.0.0.1:8788/`. The server serves only the timer page, on loopback.
There is no dependency installation. Other static HTTP hosts can serve the same
unchanged file. `bun run build` checks the inline JavaScript syntax and copies
the standalone file to `dist/index.html`; it adds no runtime dependency.

Enter 1–999 whole minutes and press Start. Start/Resume makes a quiet check beep;
completion uses a two-note chime. Pause cancels the pending chime and preserves
the remaining duration. Editing the minutes while paused resets it. Completion
stops the timer, announces the completed state and restores the configured time.
Press Start for another run; there is no automatic cycle or work/break tracking.

Tab navigates the controls and readable timer. Space/Enter activates a focused
button; Space elsewhere starts/pauses without interfering with the minutes
field. State changes are announced separately from the continuously changing
clock, so a screen reader is not interrupted every second.

## Background timing and sound

The display is calculated from a `performance.now()` deadline, not from a count
of interval callbacks. Start/Resume creates or resumes Web Audio within the
user's input event. Two oscillator notes are scheduled for the deadline on the
audio clock; the final JavaScript interval is **not** responsible for starting
the chime. Pause cancels those notes, and resume schedules the remaining time.
No worker, continuous silent audio or browser-policy override is used.

Chrome can delay background JavaScript timers. The audio scheduling approach
avoids making the chime depend on that callback. A delayed visual update catches
up from the deadline when JavaScript runs again. See Chrome's
[timer throttling explanation](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
and Google's [audio scheduling discussion](https://web.dev/articles/audio-scheduling).

Audio failures leave the visual countdown working. The page explains how to
enable sound and retries when the user pauses/resumes. An unresolved permission
promise cannot hold up the timer. If the audio context is interrupted, obsolete
notes are cancelled; if it resumes before the deadline, the remaining time is
scheduled again. A stale future alarm is cancelled if its audio clock stopped
while the countdown expired.

Important limits:

- Site sound blocking, a muted tab, OS volume, missing output devices and browser
  autoplay policy can prevent audible output. A running AudioContext does not
  prove that speakers are audible. Check the short start beep, unmute the tab
  and device, and set Chrome site controls → Site settings → Sound → Allow, then
  pause/resume. This respects the user's settings; it cannot override them.
- Keep Chrome running, the page open and the computer awake. Closing/reloading
  the page, OS sleep, browser process termination or tab discard can prevent the
  alarm. State is not persisted across reloads. Navigating away cancels sound
  and pauses the timer; returning through the back/forward cache needs Resume.
- No desktop Notification permission is requested. The completed message, page
  title and screen-reader status are the visual fallback. Notification settings
  therefore do not control the chime. In a background tab, those page updates
  may be delayed until the browser allows JavaScript to run.
- A context that cannot resume remains a visual-only timer, with instructions.
  Sound denied and later allowed is recovered through an explicit user gesture.

Chrome's [autoplay policy](https://developer.chrome.com/blog/autoplay) and
[page lifecycle documentation](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
describe the platform constraints. No webpage can guarantee an alarm after its
process is stopped or while the operating system prevents audio.

## Automated checks

```sh
bun test
bun run build
```

The tests execute the actual inline application with synthetic DOM, monotonic
clock and Web Audio interfaces. They cover validation, deadline accuracy with no
callbacks, start/pause/resume, completion/reset, cancelling obsolete notes,
blocked/unsupported/failed audio, delayed promises, recovery, keyboard behavior,
visibility and navigation cleanup. They do not establish audible Chrome output.

Two focused negative controls deliberately alter the source **in memory only**:

```sh
POMODORO_MUTANT=callback-clock bun test -t 'deadline remains accurate'
POMODORO_MUTANT=immediate-audio bun test -t 'audio is prepared in the user gesture'
```

Each must fail its behavior assertion. The shipped HTML is never modified by
these controls. On PowerShell, set `$env:POMODORO_MUTANT` before the command and
remove it afterwards. The original repository contained documentation only;
these are fault-detection controls, not claims of pre-existing timer regressions.

## Browser acceptance checks

Record the real Chrome version, OS, permission settings, timing and whether the
chime was actually heard. In-app Chromium and mocked audio are not substitutes
for recent desktop Chrome's minimized/background behavior.

1. First visit: set 1 minute, Start, confirm the check beep. Pause after several
   seconds, wait, Resume; the paused interval must not consume remaining time.
2. For the requested 30-second background scenario, start a valid 1-minute timer
   and switch to another tab when the display reaches 00:30. Hear one completion
   chime; return to Completed and a reset 01:00 display. This keeps the specified
   whole-minute input range intact.
3. Repeat with Chrome minimized and another app active. Also check a timer longer
   than 5 minutes in the background to exercise intensive timer throttling.
4. Set Chrome's site Sound to Block. The timer must still complete visually;
   silence is expected. Restore Allow, pause/resume a new run, and confirm sound
   returns. If Chrome requests a reload after changing the setting, reload and
   start a fresh timer. Repeat with Notifications blocked/allowed; no permission
   request is made and timer behavior should not depend on that setting.
5. Try empty, text, 0, -1, 1.5 and 1000; all must show an error without starting.
   Check 1 and 999 are accepted, and Tab/Space/Enter operate the controls.

Actual observed results and remaining gaps belong in the submission's testing
notes. Do not treat these instructions as evidence the browser checks passed.
