# Pomodoro timer prototype ($200 bounty)

Single-file Chrome-focused pomodoro timer with background-capable chime.

## Files
- `index.html` — UI + timer + Web Audio scheduling

## How background audio works
1. **User gesture unlock**: first **Start** or **Unlock background audio** creates/resumes an `AudioContext` (required by Chrome autoplay policy).
2. **Scheduled chime**: when the timer starts, a short oscillator beep is scheduled at `audioContext.currentTime + remainingSeconds`. Web Audio scheduled nodes continue to fire when the tab is backgrounded for typical short pomodoro durations.
3. **Display accuracy**: `setInterval` updates the clock; on `visibilitychange` remaining time is recomputed from `performance.now()` so throttled tabs do not drift.
4. **Secondary alert**: optional `Notification` when permission is granted.

## Manual test
1. Open `index.html` in Chrome desktop.
2. Click **Unlock background audio** (or Start) once.
3. Set minutes to `1` (or use a short value and temporarily edit for 30s tests).
4. Start, switch to another tab/app, wait for end — chime should play.
5. Pause/resume and confirm countdown + reset after completion.
