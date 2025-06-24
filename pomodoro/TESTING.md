# Testing Notes for Pomodoro Timer

## Background Audio
Tested 30s timer, switched to another tab, chime played successfully.
AudioContext initialized on start button click to meet Chrome requirements.
## Permissions
Denied: Shows 'Enable audio permissions' message, timer runs visually.
Granted after deny: Audio works after enabling in Chrome settings.
## Tab Inactive
Timer accurate after 5min in background tab.
## Input Validation
Rejects -1, 0, non-numeric inputs with 'Enter 1-999 minutes' error.
## Accessibility
Tab navigation works, spacebar toggles start/pause, ARIA labels added.
Tested with NVDA screen reader for readability.
## Limitations
Chrome requires user interaction for AudioContext (handled via start button).
Audio blocked until permissions granted.
