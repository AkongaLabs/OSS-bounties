# Pomodoro Timer Prototype — Browser Limitations & Background Audio Testing Notes

**Target Bounty Issue:** https://github.com/AkongaLabs/OSS-bounties/issues/1 ($200)

## 1. Architecture & How Chrome Background Limitations Are Solved

### Challenge A: Chrome Background Tab Timer Throttling
- **Browser Limitation:** Chrome throttles standard `window.setInterval` callbacks in background/inactive tabs to once per second (and after 5 minutes of background inactivity, intensive throttling can delay main-thread timers up to 60 seconds).
- **Our Solution:**
  1. **Delta Wall-Clock Timekeeping (`Date.now()`):** Instead of decrementing a counter on each tick, the timer computes `remainingMs = targetEndTime - Date.now()`, ensuring 0ms cumulative drift regardless of tab focus state.
  2. **Inline Web Worker Ticker:** A dedicated Web Worker (`Blob` worker) runs a 200ms heartbeat outside the main UI thread, preventing background tab suspension from delaying the `00:00` completion trigger.

### Challenge B: Chrome Background Audio & Autoplay Policy
- **Browser Limitation:** Chrome's Autoplay Policy blocks audio playback unless unlocked by a foreground user gesture, and Chrome may suspend idle `AudioContext` instances when a tab is minimized or backgrounded.
- **Our Solution:**
  1. **User-Gesture Audio Unlocking:** Clicking **Start** immediately unlocks both an embedded base64 WAV `HTMLAudioElement` (`data:audio/wav;base64,...`) and a Web Audio API `AudioContext`.
  2. **Sub-Threshold Keep-Alive Stream:** While the countdown is running, an imperceptible gain node (`0.00001`) keeps the `AudioContext` active so Chrome does not suspend the audio pipeline when the user switches tabs or minimizes the window.
  3. **Dual-Engine Chime Playback:** At `00:00`, both the pre-buffered WAV `<audio>` element and the synthesized 3-note harmonic chime trigger, with graceful visual fallback and permission instructions if the user explicitly muted the site in `chrome://settings/content/sound`.

## 2. Core Testing Scenarios Verified
1. **Background Audio Test:** Set duration to `1` minute, clicked Start, switched to another application/minimized Chrome, verified chime played clearly at `00:00` and display reset to `01:00`.
2. **Permission Denial Handling:** Tested with Chrome site sound set to *Mute* — timer continues visually, flashes green on completion, and displays the inline Chrome permission help guide without throwing unhandled exceptions.
3. **Input Validation:** Verified rejection and ARIA alert messages for `0`, `-5`, `2.5`, `abc`, `1000`, and empty strings.
4. **Accessibility:** Full keyboard navigation (`Tab`, `Space`, `Enter`), high-contrast UI, and ARIA roles (`role="timer"`, `role="alert"`, `role="status"`).
