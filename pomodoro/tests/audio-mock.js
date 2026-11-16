// A recording Web Audio stand-in, used by the Bun tests to assert the exact start times the
// chime is scheduled for. It deliberately mirrors the small part of the API the app touches.
export function createAudioContextMock({ state = "running", currentTime = 0, resumable = true } = {}) {
  const oscillators = [];
  const gains = [];
  const stateListeners = new Set();

  const context = {
    state,
    currentTime,
    destination: { node: "destination" },
    resumeCalls: 0,
    oscillators,
    gains,

    createOscillator() {
      const oscillator = {
        type: "",
        startedAt: null,
        stopCalls: [],
        frequencyValues: [],
        connect: (node) => node,
        disconnect: () => {},
        frequency: {
          setValueAtTime(value, time) {
            oscillator.frequencyValues.push([value, time]);
          },
        },
        start(when) {
          oscillator.startedAt = when === undefined ? context.currentTime : when;
        },
        stop(when) {
          oscillator.stopCalls.push(when === undefined ? null : when);
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    },

    createGain() {
      const gain = {
        events: [],
        connect: (node) => node,
        disconnect: () => {},
        gain: {
          setValueAtTime(value, time) {
            gain.events.push(["setValueAtTime", value, time]);
          },
          linearRampToValueAtTime(value, time) {
            gain.events.push(["linearRampToValueAtTime", value, time]);
          },
          exponentialRampToValueAtTime(value, time) {
            gain.events.push(["exponentialRampToValueAtTime", value, time]);
          },
        },
      };
      gains.push(gain);
      return gain;
    },

    async resume() {
      context.resumeCalls += 1;
      if (!resumable) throw new Error("NotAllowedError: audio was not unlocked by a user gesture");
      context.state = "running";
    },

    addEventListener(type, listener) {
      if (type === "statechange") stateListeners.add(listener);
    },

    dispatchStateChange() {
      for (const listener of stateListeners) listener({ type: "statechange" });
    },
  };

  return context;
}
