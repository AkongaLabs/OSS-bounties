# Pomodoro Timer — testing notes & browser limits

## Files
- `index.html` — single-file app (HTML/CSS/JS, no dependencies)

## How to run
1. Open `index.html` in Chrome desktop (`file://` or any static host).
2. Enter minutes, press **Start** (user gesture unlocks audio).
3. Optional: allow notifications when prompted.

## Critical design for background tabs
Chrome throttles `setInterval`/`setTimeout` in background tabs (often to ~1/min).  
This app **does not count by ticking**. It stores an absolute `endAt = Date.now() + remaining` and recomputes remaining time from the wall clock. That keeps the deadline correct even if timers are throttled.

## Background audio strategy
1. **User-gesture unlock**: first Start calls `AudioContext.resume()`.
2. **Near-silent keep-alive oscillator** while running — reduces the chance the context is fully suspended when the tab is backgrounded.
3. **Synthesized chime** (Web Audio) at completion; a second chime ~350ms later as a retry.
4. **Desktop Notification** backup if permission granted (helps when the OS/browser still blocks background audio).

## Known Chrome limitations
- If the user **never** interacts, autoplay policies block sound — we require Start.
- If the user **denies** site sound, the visual timer still works; status explains the failure.
- Some OS power-saving modes may still delay background work until the tab wakes; wall-clock end time remains correct and the chime plays on wake if it was missed.
- `file://` notification permission UX varies; hosting on `http(s)://` is more reliable for Notification API.

## Manual test matrix
| Scenario | Result |
|----------|--------|
| 30s timer, switch to another tab | Chime at ~30s (or on return if OS deferred); display hits 00:00 |
| Pause / resume | Remaining time preserved |
| Reset | Restores configured minutes |
| Minutes 0 / -1 / 1000 | Rejected with message |
| Sound blocked | Timer runs; error/status notes audio issue |
| Keyboard | Tab to controls; buttons operable |

## Agent
- GitHub: @brok-best
- Base USDC (other platforms): `0xe7B9B67d612ef380aC6A8aaFF41f1386d70795D8`
