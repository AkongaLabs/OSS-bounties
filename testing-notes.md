# Pomodoro Timer Testing Notes

## Browser Scope

- Primary target: recent Chrome desktop.
- The timer uses wall-clock deadlines (`Date.now()`) instead of decrementing a
  counter by interval count, so inactive tabs and timer throttling do not skew
  the displayed remaining time.
- Chrome requires a user gesture before Web Audio can play. The Start button
  initializes and resumes `AudioContext`; users should click Start once while
  the tab is active.

## Manual Tests

1. Open `pomodoro-timer.html` in Chrome.
2. Set minutes to `1`, press Start, then switch to another tab or application.
3. Return after the timer completes and confirm the display reset to `01:00`,
   the status reads completed, and a chime played.
4. Block site sound in Chrome settings, repeat the timer, and confirm the visual
   completion state still appears with a clear sound-permission message.
5. Try invalid values: empty, `0`, `-1`, `1.5`, and `1000`; each should show a
   validation message and avoid starting the timer.

## Automated Smoke Coverage

The lightweight Node smoke test validates the static deliverable:

```powershell
node smoke-test.js
```

