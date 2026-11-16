# Browser limitations, and what this app does about them

Scope: recent **Chrome desktop** (tested on Chrome 141, Windows). Other browsers are not the
target; anything likely to behave differently is noted below. Facts about Chrome's behaviour are
marked with a source, everything else is an observation from testing.

## 1. Autoplay policy: no sound before a click

Chrome blocks audio until the page has been interacted with ("sticky activation"). An
`AudioContext` created before that starts in the `suspended` state, and a chime played at the end
of a timer is silently dropped.

*Source: Chrome's autoplay policy — https://developer.chrome.com/blog/autoplay*

**Mitigation.** The context is created and resumed inside the click that starts the timer, which
is why the first Start can show the notification prompt and the chime at once. `Test chime`
exists for exactly this: unlock audio and hear it, without disturbing a running timer. If
`resume()` is refused, the UI says sound is blocked and gives the fix (padlock → Site settings →
Sound → Allow) instead of failing silently.

## 2. Hidden tab throttling: JavaScript timers are not a clock

Chrome throttles timers in hidden tabs to once a second, and after five minutes hidden — with a
chain count of five or more and no recent sound — to **once a minute** ("intensive throttling").

*Source: https://developer.chrome.com/blog/timer-throttling-in-chrome-88*

A `setTimeout(remainingMs)` alarm can therefore ring up to a minute late, and a `setInterval`
countdown loses ticks. This is the default failure mode of a naive pomodoro timer, and it is why
"the tab must be visible" is a common complaint about them.

**Mitigation, in order of importance:**

1. The chime is armed on the **audio clock** (`oscillator.start(ctx.currentTime + remainingSeconds)`).
   Audio rendering runs on the audio thread with its own clock, so it is not subject to the timer
   throttling above. One arm covers the whole countdown; if audio is later suspended, the arm
   survives and is delivered when audio resumes.
2. The countdown is **derived, never accumulated**: every tick recomputes `deadline - Date.now()`.
   Throttling can delay the next repaint but cannot make the timer drift, so the display is
   correct the moment the tab is looked at again.
3. `visibilitychange`, `focus`, `pageshow` and the Page Lifecycle `resume` event each trigger a
   catch-up (recompute, re-arm if needed, refresh permission notices).
4. When the wake-up really was late, the app says so ("Chrome woke this tab 45 seconds late
   because it was hidden, so the reset is late while the sound is not") and logs
   `noticed <n>ms after the deadline`. Late pixels are reported, not hidden.

### The silent-audio trick does not work

A widely suggested workaround is looping a silent `<audio>` element to keep the tab "audible" and
escape throttling. Chrome explicitly excludes it: throttling looks at whether the page *made
noises* recently, and **"a silent audio track doesn't count"** (same source as above). It is not
used here, and neither is a hidden near-silent oscillator, which would be the same gamble. The
chime scheduling above makes the workaround unnecessary.

## 3. Tab freezing and discarding (Page Lifecycle API)

Chrome may freeze a hidden tab (timers, and the audio clock with them, stop advancing) or discard
it entirely when resources are tight. Both are documented lifecycle states with `freeze` and
`resume` events.

*Source: https://developer.chrome.com/docs/web-platform/page-lifecycle-api*

**Mitigation.**

- While a run is active the page holds a Web Lock (`navigator.locks.request`). A held lock is an
  extra signal that the page is still doing work, which browsers weigh when deciding to freeze or
  discard a tab; the code treats it as a safeguard, not as a guarantee. If `navigator.locks` is
  missing the call is skipped and nothing else changes.
- `freeze` is logged, and `resume` runs the same catch-up path as `visibilitychange`. If a freeze
  swallowed the arm, the timer completes late on resume, plays the chime immediately (nothing was
  armed any more) and the status line explains the delay.
- A **discarded** tab loses everything: the countdown, audio and the notification. No single-file
  prototype can survive that, and the brief does not ask for persistence across reloads.

## 4. Audio context can be suspended mid-run

Chrome suspends an `AudioContext` when the audio device changes, when the tab is frozen, and in
some power-saving conditions. A suspended context stops advancing its clock, so an armed chime is
delivered later rather than lost.

**Mitigation.** A `statechange` listener re-checks and re-arms whenever audio comes back, and the
notice tells the user that audio is suspended and that `Test chime` wakes it up.

## 5. Notifications

- `Notification` requires permission and, on some Chrome configurations, a secure origin.
  `file://` counts as a secure context in Chrome, but notification support for `file://` has
  varied by version — serving the page over `http://localhost` is the reliable path, and it is
  what `bun run serve` is for.
- `Notification.requestPermission()` must be called from a user gesture. It is called from the
  Start click, not on page load, which also keeps the "first load" experience quiet.
- If permission was **denied**, Chrome will not prompt again; the app detects that
  (`Notification.permission === "denied"` plus a `navigator.permissions` change listener) and
  prints the manual path instead of pretending it could notify.
- Chrome honors the OS "Do not disturb"/Focus Assist setting, so a granted permission can still
  produce no visible toast. The chime and the flashing title cover that case.

## 6. Things that are intentionally not attempted

| Idea | Why not |
| --- | --- |
| Service worker + `showTrigger` (notification triggers) | Experimental, behind a flag on desktop, removed from stable Chrome. |
| Background Sync / Periodic Sync for a chime | Wake-ups are best-effort and minutes apart — worse than the audio clock, not better. |
| Web Push | Needs a server, a VAPID key pair and internet access; the brief wants a single offline file. |
| Silent audio keep-alive | Excluded by Chrome, see 2. |
| Screen wake lock | Keeps the display awake, does nothing for timers or audio; hostile to the user's battery. |
| Persisting the countdown in `localStorage` | Out of scope for the brief; the discarded-tab case is documented above instead. |
| Playback through a hidden `<video>`/WebRTC track | Needs hardware and codec negotiation for a 1.2 second chime. |

## 7. Other browsers (not target, FYI)

- **Firefox / Safari** have their own autoplay rules; the `resume()`-in-a-gesture pattern is what
  both want, so the app generally works, but invisible-tab throttling policy differs.
- **Safari** requires `webkitAudioContext` (handled) and is stricter about creating contexts
  without a gesture (handled).
- **Mobile Chrome** throttles far more aggressively and the notification path differs; not a
  target for this prototype.
