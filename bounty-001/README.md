# 🧘 Zen Focus Timer

A modern, minimalist Pomodoro/focus timer web application with advanced background operation capabilities and seamless notifications.

## ✨ Features
 Approaches:
 - start a timer and countdown in the page while triggering a service worker to run in the background and send a notification when the timer is done
- while for a simple 30 seconds timer, the service worker is overkill and the tab will still be available in the background, i went with the service worker approach to allow for easier migration if push notifications are deemed desirable in the future
- browsers are known to kill background tabs and service workers too but the service worker will be able to run in the background for longer

## 📱 How to Use

### Setting Up Your Timer
1. **Set Duration**: Enter your desired focus time (default: 25 minutes)
2. **Grant Permissions**: Allow notifications and audio for the best experience
3. **Click "Start Focus"**: Begin your focused work session

### During Your Session
- **Pause**: Click "Pause" to temporarily stop the timer
- **Resume**: Click "Resume" to continue from where you left off
- **Stop**: Click "Stop" to reset the timer completely
- **Background Mode**: Close the tab - timer continues running!

### When Timer Completes
- **Browser Notification**: Get notified even with the tab closed
- **Audio Alert**: Hear a pleasant chime sound
- **Break Option**: Click "Start Break" from the notification for a 5-minute break

## 🔧 Technical Details

### Architecture
- **Frontend**: Pure HTML5, CSS3, and JavaScript (ES6+)
- **Service Worker**: Advanced background processing with IndexedDB
- **Audio Engine**: Web Audio API for cross-platform sound generation
- **Storage**: IndexedDB for persistent timer state

### Browser Compatibility
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11.1+
- ✅ Edge 79+
- ⚠️ Requires service worker support for background operation

### Key Technologies
- **Service Workers**: Background timer execution
- **IndexedDB**: Persistent state storage
- **Web Audio API**: Custom notification sounds
- **Notifications API**: Browser notifications
- **CSS Grid/Flexbox**: Responsive layout
- **ES6 Classes**: Modern JavaScript architecture

## 🛠️ Advanced Configuration

### Customizing Timer Durations
Edit the default values in `pomo.html`:
```javascript
// Change default focus duration (minutes)
sessionMinutes: 25, // Your preferred default

// Modify break duration in startBreakSession()
this.configure(5); // Your preferred break length
```

### Audio Customization
The app generates its own notification sound, but you can modify the audio in the `generateNotificationSound()` method:
```javascript
// Adjust frequencies for different tones
sample += Math.sin(2 * Math.PI * 523.25 * time) * 0.4; // C5 note
```

## 🔒 Privacy & Permissions

### Required Permissions
- **Notifications**: For timer completion alerts
- **Audio**: For sound notifications
- **IndexedDB**: For timer persistence (automatic)

### Data Storage
- All data is stored locally in your browser
- No information is sent to external servers
- Timer state is saved in IndexedDB for persistence
- No tracking or analytics

### Permission Handling
- Smart detection of existing permissions
- Graceful fallbacks if permissions are denied
- No repeated permission prompts after initial grant

## 🎯 Use Cases

### Pomodoro Technique
- 25-minute focus sessions
- 5-minute breaks
- Longer breaks every 4 sessions

### Custom Focus Sessions
- Deep work sessions (60-90 minutes)
- Meeting timers
- Study sessions
- Meditation practice

### Background Usage
- Timer runs while working in other apps
- Perfect for full-screen applications
- No need to keep browser tab open

## 🔧 Troubleshooting

### Timer Not Running in Background
- Ensure you're accessing via HTTP/HTTPS (not file://)
- Check that service workers are enabled in your browser
- Grant notification permissions for full functionality

### No Sound Notifications
- Grant audio permissions when prompted
- Check browser audio settings
- Ensure browser isn't muted

### Notifications Not Showing
- Grant notification permissions
- Check browser notification settings
- Ensure "Do Not Disturb" mode is off

### Timer State Lost
- Service workers need HTTPS or localhost
- Check if IndexedDB is enabled
  
#  # Improvement recommendations
- Usage use push notifications with service workers for better reliability and sync across devices




