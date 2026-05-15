# Background Audio Pomodoro Testing Notes

## Scope

This submission targets AkongaLabs/OSS-bounties issue #1. The app is a single HTML file with embedded CSS and JavaScript, no external assets, and no build step.

## Local Run

Open `submissions/pomodoro-background-audio-foxhub2020/index.html` directly in Chrome desktop, or serve the repository root with any static server and visit the same path.

## Automated Static Checks

The page includes deterministic browser self-tests for parsing and formatting helpers. Open:

```text
index.html?selftest=1
```

Expected result:

```text
SELF TEST PASS
PASS parse valid minutes
PASS reject zero
PASS reject decimals
PASS reject out of range
PASS format one minute
PASS format rounds up
PASS format clamps negative
```

Checks run before submission:

```text
git diff --check
npx --yes prettier --no-config --check submissions/pomodoro-background-audio-foxhub2020/index.html submissions/pomodoro-background-audio-foxhub2020/TESTING.md
node -e "extract inline script and parse with new Function"
Playwright + local Chrome: browser self-test PASS
Playwright clock fast-forward: completion reset PASS
```

Screenshot evidence is included in:

```text
submissions/pomodoro-background-audio-foxhub2020/evidence/selftest.png
submissions/pomodoro-background-audio-foxhub2020/evidence/running.png
submissions/pomodoro-background-audio-foxhub2020/evidence/complete.png
submissions/pomodoro-background-audio-foxhub2020/evidence/demo.webm
```

## Manual Test Matrix

| Scenario                | Steps                                                         | Expected result                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First load              | Open the page in Chrome                                       | The display shows `25:00`, the status asks the user to press Start, and the only control is Start.                                                      |
| Input validation        | Enter `0`, `-1`, `1.5`, empty, and `1000`                     | The timer does not start and the status asks for a whole number from 1 to 999.                                                                          |
| Start and pause         | Enter `1`, press Start, then press Pause                      | The input locks while running, the display counts down, then pauses at the remaining time.                                                              |
| Resume                  | Press Start after pausing                                     | The countdown resumes from the paused remaining time.                                                                                                   |
| Completion reset        | Let the timer reach zero                                      | The chime is scheduled, the status changes to done, and the display resets to the configured time.                                                      |
| Background timing       | Start a short timer, switch to another tab or app             | The countdown is based on `Date.now()`, so it catches up accurately when the tab is visible again.                                                      |
| Background audio        | Start a short timer while the tab is active, then switch away | Chrome has a user gesture, the page unlocks Web Audio, and the chime is scheduled on the audio clock before tab throttling can delay JavaScript timers. |
| Sound blocked           | Block site sound in Chrome settings and repeat completion     | The timer still completes visually and reports the completion state.                                                                                    |
| Notification permission | Allow or deny notification permission when prompted           | Allowed permission shows a silent desktop notification on completion; denial does not stop the timer or audio path.                                     |

## Browser Limitation Notes

Chrome requires a user gesture before a page can start audio. This implementation creates and resumes `AudioContext` inside the Start click handler, emits a near-silent unlock pulse, and schedules the completion chime on the Web Audio clock immediately. If a user has blocked site sound at the browser level, no web page can force audio playback; the visual completion state remains the fallback.
