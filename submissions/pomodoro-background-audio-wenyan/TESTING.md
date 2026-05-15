# Pomodoro Background Audio Testing

## Files

- `index.html` contains the complete Pomodoro prototype with embedded CSS and JavaScript.
- No external dependencies, build step, package manager, server, or database are required.

## How to Run

Open the file directly in recent Chrome desktop:

```text
submissions/pomodoro-background-audio-wenyan/index.html
```

Optional static server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/submissions/pomodoro-background-audio-wenyan/index.html
```

## Self-Test

Open the page with `?selftest=1` to run built-in deterministic tests for time formatting and input validation:

```text
index.html?selftest=1
```

Expected output includes:

```text
PASS format zero
PASS format partial rounds up
PASS format one minute
PASS parse min
PASS parse max
PASS reject ""
PASS reject "0"
PASS reject "1000"
PASS reject "1.5"
PASS reject "abc"
```

## Manual Test Matrix

### 1. Background Audio Test

1. Set timer to `1` minute or temporarily edit the input using browser devtools for a shorter value during review.
2. Press Start once. This unlocks Chrome Web Audio via a user gesture and schedules the completion chime on the audio clock.
3. Switch to another Chrome tab or minimize Chrome.
4. Wait until the timer should finish.
5. Expected: the chime plays even while the page is backgrounded/minimized, and the display resets to the configured duration when visible again.

### 2. Tab Inactive Accuracy

1. Set timer to `1` minute.
2. Press Start and immediately switch to another tab for about 30 seconds.
3. Return to the timer tab.
4. Expected: the display reflects wall-clock elapsed time, not throttled interval ticks.

### 3. Pause/Resume

1. Start a timer.
2. Press Pause.
3. Wait several seconds.
4. Press Resume.
5. Expected: countdown continues from the paused remaining time, not from the original duration.

### 4. Input Validation

Try these values and confirm a clear validation message appears:

- Empty value
- `0`
- `-1`
- `1.5`
- `1000`
- Non-numeric pasted text

Expected: valid range is whole minutes from `1` to `999`.

### 5. Audio Permission / Blocked Sound Scenario

1. In Chrome site settings, block sound for the page origin if running through a local server, or mute the tab.
2. Start and complete a timer.
3. Expected: the timer still completes visually. If Web Audio cannot be started/resumed, the status area shows instructions to enable site sound and press Start again.

## Implementation Notes

- Countdown accuracy is based on a stored wall-clock deadline (`Date.now()`), so inactive-tab timer throttling does not accumulate drift.
- Background audio reliability uses Web Audio scheduling. The alarm is scheduled at Start/Resume time after a user gesture unlocks the `AudioContext`, which is more reliable than waiting until a backgrounded JavaScript timer fires.
- Wake Lock is requested when available, but it is optional. The timer remains correct without it.
