# Pomodoro Timer - Browser Limitations & Testing Notes

## Background Audio

This timer uses the **Web Audio API** (AudioContext + OscillatorNode) for completion sounds, which is the only reliable way to play audio in Chrome background tabs. HTMLAudioElement gets throttled when the tab is not focused; Web Audio API does not.

### How It Works
1. AudioContext is created on first user click (Start button)
2. On completion, two sine wave oscillators play an ascending C5→E5 chime
3. The audio runs independently of the tab's visibility state

### Known Chrome Limitations
- AudioContext starts in "suspended" state until a user gesture occurs
- If the user has never interacted with the page, audio won't play
- The permission banner guides users through this on first load

## Timer Accuracy

The timer uses `Date.now()` absolute deadlines rather than counting down each tick. This means:
- If Chrome throttles the tab, the timer catches up when the tab regains focus
- `requestAnimationFrame` provides smooth display updates when visible
- A 1-second `setInterval` fallback ensures the completion fires even in background tabs
- `visibilitychange` event handler catches any edge cases

## Desktop Notifications

Notifications are requested but not required. The timer works fully with:
- Visual flash overlay (3 quick flashes)
- Audio chime
- Tab title update showing countdown
- Notification (if granted)

## Input Validation

| Input | Result |
|-------|--------|
| Empty | Error: "Enter a number of minutes" |
| 0 | Error: "Minimum is 1 minute" |
| -5 | Error: "Minimum is 1 minute" |
| 1000 | Error: "Maximum is 999 minutes" |
| 25.5 | Error: "Enter a whole number" |
| abc | Error: "Enter a whole number" |
| 25 | Valid, sets timer to 25:00 |

## Keyboard Navigation

- **Tab**: Move between controls
- **Space/Enter**: Start, Pause, or Resume timer
- **Escape**: Reset timer

## Testing Scenarios

### Scenario 1: Background Audio (Critical)
1. Open `pomodoro-timer.html` in Chrome
2. Set minutes to 1
3. Click Start
4. Switch to another tab
5. Wait for timer to reach 00:00
6. Verify: Sound plays, tab title shows "00:00 - Pomodoro Timer"

### Scenario 2: Tab Inactive Accuracy
1. Set timer to 5 minutes
2. Click Start
3. Switch away for 2 minutes
4. Switch back
5. Verify: Timer shows ~3:00 remaining (not reset to 5:00 or stuck)

### Scenario 3: Permission Denied
1. Open DevTools → Site Settings → Sound → Block
2. Reload page
3. Start timer
4. Verify: Permission banner appears, timer still counts down
5. Verify: Visual flash still works on completion

### Scenario 4: Input Validation
1. Try entering: 0, -1, 1000, 25.5, "abc"
2. Verify: Appropriate error message for each
3. Verify: Timer cannot start with invalid input

### Scenario 5: Keyboard Only
1. Tab to Minutes input, type 1
2. Tab to Start button, press Space
3. Timer starts
4. Tab to Pause, press Space
5. Timer pauses
6. Press Escape
7. Timer resets
