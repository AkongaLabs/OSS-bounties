# Pomodoro Timer — Testing and Browser Limitations

## Background Audio Testing

### How it works
The timer uses the **Web Audio API** (`AudioContext` + `OscillatorNode`) for notification sounds. This is the recommended approach because:

- Chrome **does NOT throttle** Web Audio API in background tabs (unlike `HTMLAudioElement` / `<audio>` tags)
- Audio timing is handled by the system audio clock, not the JS event loop
- OscillatorNode produces a clean chime without needing external audio files

### Test Scenarios

1. **Background audio** — Set 30 seconds, start timer, switch to another tab. Sound should play clearly when timer hits 0.
2. **Permission denied** — Block sound in Chrome Site Settings → the timer still works visually with guidance text
3. **Permission granted later** — AudioContext initializes on first Start click per Chrome autoplay policy
4. **Tab inactive** — `setInterval` continues counting in background; tested with 30s timer and 60s of switching tabs

### Known Browser Limitations

| Behavior | Chrome | Notes |
|---|---|---|
| Background Web Audio | ✅ Works | OscillatorNode not throttled |
| Background `<audio>` | ❌ Paused | Do not use HTMLAudioElement |
| AudioContext suspend | Resumed on interaction | First Start click initializes |
| Notification API | ✅ Works | Requires permission |
| Timer accuracy | ±100ms | Standard setInterval drift |

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| Web Audio API over HTMLAudioElement | Only reliable way to play sound in background tabs |
| OscillatorNode over audio files | Zero dependencies, works offline, simple chime |
| setInterval over Web Workers | Sufficient accuracy for a pomodoro timer (±100ms acceptable) |
| Single HTML file | Meets bounty requirement exactly |
| No external deps | Self-contained, works offline |

## Files

- **pomodoro-timer.html** — Single HTML file with embedded CSS/JS, the complete implementation
- **README.md** — This testing documentation
