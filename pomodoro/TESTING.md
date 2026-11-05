# Pomodoro timer — testing and browser limits

The timer is the single file `pomodoro.html` at the repository root. CSS and JavaScript are inlined. Nothing is loaded from the network.

## Run the tests

[Bun](https://bun.sh) is the package manager for this repo. From the repository root:

```bash
bun test
```

The tests load `PomodoroCore` out of `pomodoro.html` and cover minute validation, the MM:SS clock, wall-clock start / pause / resume / completion (including the reset back to the configured length), and the permission copy.

## Open the page

Use a local web origin. Notification permission and site sound settings are easier to reset on `http://localhost` than on a `file://` URL.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/pomodoro.html` in desktop Chrome. There is no build step and no environment variables. There is no database.

## What was verified

`bun test` covers validation, the MM:SS clock, wall-clock start / pause / resume / completion, and the permission copy. The page was also driven in desktop Chrome 156.

- Validation: empty, spaces, `0`, `000`, negatives, decimals (`1.5`, `0.5`), `1000`, a very large integer, `abc`, `1e2`, `+5`. An invalid string does not keep an in-between preview (typing `1000` shows the error and leaves the clock on the last good length).
- A 25-minute value renders `25:00`. Partial seconds round up so the first second stays on the full minute, and `00:00` is reserved for the actual end.
- Pause freezes the remaining time. Resume continues that remainder instead of restarting the session. A second Start while running does not move the end time.
- At zero the phase becomes "Time's up" and the digits return to the configured minutes.
- Escape cancels a running or paused session. Space starts and pauses when focus is not in a control. Enter in the minutes field submits Start.
- Sound is unlocked inside the Start gesture, before the notification prompt, so the prompt does not consume the gesture Chrome needs for audio. After a real click on Start, the sound chip read **Sound on** and Chrome showed the tab speaker state by accepting the audio graph.
- The end chime is scheduled with `AudioContext.currentTime`, not with `setTimeout`. A one-minute Start scheduled three oscillators about 60.06s, 60.22s, and 60.38s ahead on that clock, plus a one-sample marker at the same instant whose `onended` finishes the session if the JS timer is late. A near-silent 19 kHz keep-alive runs for the session so Chrome keeps the audio device awake.
- A one-minute session was started, then another tab was opened so `document.hidden` was `true`. After 62 seconds the hidden page showed **Time's up**, the clock had reset to `01:00`, and the document title was `Time's up · Pomodoro`.
- If `AudioContext` stays suspended, the clock still runs, the status text says sound is blocked, and the notes panel opens with the Chrome sound steps.
- Notification permission is requested on Start. In desktop Chrome the prompt offers Block and Allow. Allowing it flips the chip to **Alerts on**. Denied, default, and later changes (via `permissions.query` `onchange`) update the alert chip and the notes. The desktop notification is silent when our chime is armed, and audible when sound is blocked, so there is still an OS-level cue.
- This environment has no audio output device, so the chime was confirmed by its scheduled audio-clock time rather than by a recorded waveform.

The published manual scenario of a 30-second timer is below the 1-minute minimum in the bounty ("1–999 minutes", decimals rejected). The short run to use is 1 minute.

## Chrome desktop limits

- `setTimeout` / `setInterval` in a hidden tab are clamped to 1 second, and after about 5 minutes hidden **and** silent they can drop to one callback per minute. The digits are computed from `Date.now()` and the end timestamp, so a late callback snaps to the true remaining time instead of drifting. The chime does not wait on that callback.
- The chime itself is an oscillator graph started at a future `AudioContext` time. That clock runs on the audio thread. This is the path that rings while the tab is in the background or minimized, including under intensive timer throttling.
- Chrome can still suspend a silent audio context in the background. The keep-alive is there to stay under that rule. If the context suspends anyway (site sound set to Block, or the machine itself muted), the page shows **Sound blocked** and the steps below. The countdown and the "Time's up" state still happen. Returning to the tab tries `resume()`.
- There is no Permissions API name for site sound in current Chrome. "Blocked" is detected by `AudioContext.state` staying `suspended` after `resume()` from the Start click.
- Desktop notifications fire when the page's finish step runs. If the renderer is frozen, the banner can trail the chime by a short time; the chime is the on-time signal. macOS Focus and Windows Do Not Disturb can hide the banner even when permission is Allow.
- `new Notification` from the page needs a normal http(s) origin. On `file://`, Chrome may refuse the prompt. Serve the file locally if you need to test alerts.
- The keep-alive is a 19 kHz tone at gain `0.0008`. It is meant to be inaudible and to show Chrome's tab speaker icon, which is the sign the chime is armed. Headphones with strong high-frequency response may pick up a faint tone; that is the trade for keeping the audio device awake.
- Workers are not used. Hidden-tab worker timers are throttled too. The audio thread is the clock that still fires.
