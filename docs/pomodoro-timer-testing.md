# Pomodoro Timer Testing Notes

The app for issue #1 is `pomodoro-timer.html`. It is a single HTML file with embedded CSS and JavaScript. It uses no network assets, packages, build step, or external audio files.

## Chrome Background Audio Approach

- The first Start click creates and resumes a Web Audio `AudioContext` from a user gesture, which is the Chrome requirement for later sound playback.
- Completion audio is built with oscillator tones, so there is no media file to load and no autoplay race around an `audio` element.
- Countdown state uses an absolute `Date.now()` deadline. If Chrome slows interval callbacks while the tab is inactive, the next tick catches up to the real remaining time instead of drifting by missed intervals.
- A dedicated worker created from an inline Blob provides an additional tick source while keeping the app deliverable to one HTML file.
- The page requests desktop notification permission as a visual fallback when allowed by the browser context.
- The document title changes while running and on completion, so the user still gets visible state when audio or notifications are blocked.
- Screen Wake Lock is requested when available, then released on pause, reset, or completion. Unsupported browsers simply ignore this enhancement.

## Manual Test Matrix

1. Open `pomodoro-timer.html` in recent Chrome desktop.
2. Enter `1`, click Start, switch to another tab or app, and confirm the timer completes with a chime.
3. Repeat with Chrome site sound muted or blocked and confirm the page shows a clear fallback message without breaking the timer.
4. Allow desktop notifications and confirm the completion notification appears when the tab is in the background.
5. Deny desktop notifications and confirm the timer still completes with the page flash/title fallback.
6. Pause and resume a running timer, then confirm the countdown continues from the paused value.
7. Try invalid values: empty, `0`, `-1`, `1.5`, `abc`, and `1000`. Each should produce a validation message and prevent start.
8. Use keyboard only: Tab through controls, press Space on the Start/Pause button, press Escape to reset, and confirm the timer display is announced through `role="timer"` and `aria-live`.

## Browser Limitations

Chrome requires a user gesture before a page can play sound. This app unlocks Web Audio from the Start click and reports a clear message if Chrome, site sound settings, tab mute state, system volume, or Do Not Disturb prevents audible playback.

Very aggressive browser sleep modes can delay JavaScript execution in background pages. The app reduces drift by using an absolute deadline and worker tick source; if the browser delays a tick, the countdown catches up immediately when execution resumes.

## Static Validation

Run this from the repository root:

```bash
node tests/pomodoro-static-check.js
```

Expected output:

```text
pomodoro static checks OK
```

## Local Validation Performed

- `node tests/pomodoro-static-check.js` passed.
- `git diff --check` passed.
- Opened `pomodoro-timer.html` through a local static server in Chrome.
- Verified invalid `0` input shows a validation error and does not start the timer.
- Verified `1` minute start flow changes the button to Pause, disables the minutes input, updates the document title, and counts down from the absolute deadline.
- Verified pause and reset return the display to the configured time without console errors.
- Verified a full `1` minute completion path resets the display back to `01:00`, leaves the app usable, reports the notification/audio fallback state, and produces no console errors.
