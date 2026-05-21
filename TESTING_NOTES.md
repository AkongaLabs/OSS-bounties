# Pomodoro Timer Testing Notes

## Files

- `pomodoro-timer.html` is a single-file implementation with embedded CSS and JavaScript.
- No package manager, build step, server, database, or environment variables are required.

## Setup

Open `pomodoro-timer.html` in recent Chrome desktop. The app can be run directly from disk or from any static file server.

## Background Audio Behavior

Chrome blocks audio that has not been unlocked by a user gesture. The timer calls `AudioContext.resume()` from the Start button click, then uses the already-resumed audio context to play the completion chime later, including while the tab is inactive. If site sound is blocked, the timer still completes visually and shows Chrome-specific recovery guidance.

## Manual Test Matrix

1. Background audio: set the timer to 1 minute, click Start, switch to another tab or app, and wait for completion. Expected result: the timer completes and plays a three-tone chime.
2. Inactive timing: start a timer, keep the tab inactive for part of the countdown, and return. Expected result: the displayed time reflects wall-clock elapsed time rather than throttled interval ticks.
3. Permission allowed: allow notifications when prompted. Expected result: completion also shows a browser notification when supported.
4. Permission blocked: block notifications or site sound. Expected result: the timer still resets visually and explains how to enable sound.
5. Input validation: try blank, zero, negative, decimal, and values above 999. Expected result: invalid values are rejected before the timer starts.
6. Keyboard access: tab through controls and press Space while focus is outside the minutes input. Expected result: the Start/Pause control toggles.

## Implementation Notes

The countdown uses an absolute deadline (`Date.now() + remainingSeconds * 1000`) and recalculates remaining time on each tick, `visibilitychange`, and window focus event. This keeps the timer accurate when Chrome throttles background JavaScript intervals.
