// zen-focus-worker.js - Advanced service worker for Zen Focus timer
// Handles background countdown, IndexedDB persistence, and notifications

const DB_NAME = 'ZenFocusDB';
const DB_VERSION = 1;
const STORE_NAME = 'timerState';
const TIMER_KEY = 'activeTimer';

// Keep service worker alive with periodic pings
let keepAliveInterval;

// Timer state management
let activeTimer = null;
let countdownInterval = null;

// Initialize IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Store timer state in IndexedDB
async function storeTimerState(timerData) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const request = store.put(timerData, TIMER_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    console.log('Timer state stored:', timerData);
  } catch (error) {
    console.error('Failed to store timer state:', error);
  }
}

// Retrieve timer state from IndexedDB
async function getTimerState() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(TIMER_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to retrieve timer state:', error);
    return null;
  }
}

// Clear timer state from IndexedDB
async function clearTimerState() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const request = store.delete(TIMER_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    console.log('Timer state cleared');
  } catch (error) {
    console.error('Failed to clear timer state:', error);
  }
}

// Start countdown timer
function startTimerCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(async () => {
    if (!activeTimer) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const now = Date.now();
    const remaining = activeTimer.endTime - now;

    if (remaining <= 0) {
      // Timer completed
      await onTimerComplete();
    } else {
      // Update remaining time and sync with clients
      activeTimer.remaining = remaining;
      await storeTimerState(activeTimer);

      // Notify all clients of the update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'TIMER_TICK',
          remaining: remaining,
          duration: activeTimer.duration,
          startTime: activeTimer.startTime,
          endTime: activeTimer.endTime
        });
      });
    }
  }, 1000);
}

// Handle timer completion
async function onTimerComplete() {
  console.log('Timer completed!');

  // Clear countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Store completion state
  activeTimer.status = 'completed';
  activeTimer.remaining = 0;
  await storeTimerState(activeTimer);

  // Show browser notification
  try {
    await self.registration.showNotification('🧘 Zen Focus Complete!', {
      body: 'Your focus session has ended. Time to take a mindful break.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'zen-focus-complete',
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'view', title: 'Open App' },
        { action: 'start-break', title: 'Start Break' }
      ]
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }

  // Notify all clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'TIMER_COMPLETE',
      duration: activeTimer.duration,
      startTime: activeTimer.startTime,
      endTime: activeTimer.endTime
    });
  });

  // Clear active timer
  activeTimer = null;
  await clearTimerState();
}

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('Zen Focus Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Zen Focus Service Worker activated');

  event.waitUntil((async () => {
    // Take control of all clients
    await self.clients.claim();

    // Check for existing timer state
    const savedTimer = await getTimerState();
    if (savedTimer && savedTimer.status === 'running') {
      activeTimer = savedTimer;
      const now = Date.now();

      if (activeTimer.endTime > now) {
        console.log('Resuming saved timer from storage');
        startTimerCountdown();
      } else {
        console.log('Saved timer already expired, completing it');
        await onTimerComplete();
      }
    }

    // Start keep-alive mechanism
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      console.log('Service worker keep-alive ping:', new Date().toISOString());
    }, 25 * 60 * 1000); // Every 25 minutes
  })());
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  console.log('Service Worker received message:', { type, data });

  switch (type) {
    case 'START_TIMER':
      handleStartTimer(data, event.source);
      break;

    case 'PAUSE_TIMER':
      handlePauseTimer(event.source);
      break;

    case 'RESUME_TIMER':
      handleResumeTimer(event.source);
      break;

    case 'STOP_TIMER':
      handleStopTimer(event.source);
      break;

    case 'GET_TIMER_STATE':
      handleGetTimerState(event.source);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Handle start timer
async function handleStartTimer(data, source) {
  const { duration, sessionType = 'focus' } = data;
  const now = Date.now();

  activeTimer = {
    id: `timer_${now}`,
    duration: duration,
    startTime: now,
    endTime: now + duration,
    remaining: duration,
    status: 'running',
    sessionType: sessionType,
    pausedAt: null,
    pausedRemaining: null
  };

  await storeTimerState(activeTimer);
  startTimerCountdown();

  source.postMessage({
    type: 'TIMER_STARTED',
    timer: activeTimer
  });
}

// Handle pause timer
async function handlePauseTimer(source) {
  if (!activeTimer || activeTimer.status !== 'running') {
    source.postMessage({ type: 'TIMER_ERROR', message: 'No active timer to pause' });
    return;
  }

  // Stop countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Update timer state
  const now = Date.now();
  activeTimer.status = 'paused';
  activeTimer.pausedAt = now;
  activeTimer.pausedRemaining = activeTimer.endTime - now;

  await storeTimerState(activeTimer);

  source.postMessage({
    type: 'TIMER_PAUSED',
    timer: activeTimer
  });
}

// Handle resume timer
async function handleResumeTimer(source) {
  if (!activeTimer || activeTimer.status !== 'paused') {
    source.postMessage({ type: 'TIMER_ERROR', message: 'No paused timer to resume' });
    return;
  }

  // Calculate new end time
  const now = Date.now();
  activeTimer.endTime = now + activeTimer.pausedRemaining;
  activeTimer.status = 'running';
  activeTimer.pausedAt = null;

  await storeTimerState(activeTimer);
  startTimerCountdown();

  source.postMessage({
    type: 'TIMER_RESUMED',
    timer: activeTimer
  });
}

// Handle stop timer
async function handleStopTimer(source) {
  // Clear countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Clear state
  activeTimer = null;
  await clearTimerState();

  source.postMessage({
    type: 'TIMER_STOPPED'
  });
}

// Handle get timer state
async function handleGetTimerState(source) {
  const savedTimer = await getTimerState();

  source.postMessage({
    type: 'TIMER_STATE',
    timer: savedTimer
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window' });

    // Try to focus existing window first
    for (const client of clients) {
      if (client.url.includes('pomo.html') && 'focus' in client) {
        await client.focus();

        // Send action to client if needed
        if (action === 'start-break') {
          client.postMessage({ type: 'START_BREAK_SESSION' });
        }
        return;
      }
    }

    // Open new window if no existing client
    if (self.clients.openWindow) {
      const newClient = await self.clients.openWindow('/pomo.html');
      if (action === 'start-break' && newClient) {
        // Wait a bit for the page to load, then send message
        setTimeout(() => {
          newClient.postMessage({ type: 'START_BREAK_SESSION' });
        }, 1000);
      }
    }
  })());
});

// Handle errors
self.addEventListener('error', (error) => {
  console.error('Service Worker error:', error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Zen Focus Service Worker script loaded');
