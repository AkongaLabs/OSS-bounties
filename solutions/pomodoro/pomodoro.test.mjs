import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Deliberate in-memory faults for focused negative controls; never shipped.
if (process.env.POMODORO_MUTANT === 'callback-clock') source = source.replace('this.deadline - this.now()', 'this.remaining');
if (process.env.POMODORO_MUTANT === 'immediate-audio') source = source.replace('oscillator.start(when)', 'oscillator.start(0)');
const module = { exports: {} };
runInNewContext(source, { module, Promise }, { filename: 'index.html:inline' });
const { parseMinutes, formatTime, Timer, mount } = module.exports;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// Synthetic browser/audio interfaces exercise the actual inline application.
// They do not prove audible output or Chrome background/permission behavior.
function fixture(mode = 'allowed') {
  let now = 0, gesture = false;
  const elements = new Map();
  for (const id of ['app', 'minutes', 'timer', 'start', 'pause', 'status', 'audio-status', 'input-error']) {
    elements.set(id, { textContent: '', value: id === 'minutes' ? '25' : '', disabled: false, dataset: {}, attributes: {}, events: {},
      tagName: id === 'minutes' ? 'INPUT' : ['start', 'pause'].includes(id) ? 'BUTTON' : 'DIV',
      setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(name, callback) { this.events[name] = callback; }, focus() { this.focused = true; },
      click() { if (!this.disabled) { gesture = true; this.events.click?.(); gesture = false; } }
    });
  }
  const docEvents = {}, winEvents = {}, intervals = new Map(), contexts = [];
  let nextInterval = 0;
  const document = { title: '', hidden: false, getElementById: id => elements.get(id), addEventListener: (event, fn) => { docEvents[event] = fn; } };
  class AudioContext {
    constructor() {
      if (mode === 'constructor-error') throw new Error('No audio device');
      this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.nodes = []; this.resumeGestures = [];
      contexts.push(this);
    }
    resume() {
      this.resumeGestures.push(gesture);
      if (mode === 'blocked') return Promise.reject(new Error('NotAllowedError'));
      if (mode === 'pending') return new Promise(resolve => { this.resolveResume = () => { this.change('running'); resolve(); }; });
      this.change('running');
      return Promise.resolve();
    }
    change(state) { this.state = state; this.onstatechange?.(); }
    createOscillator() {
      if (mode === 'node-error') throw new Error('Audio node creation failed');
      const node = { frequency: {}, starts: [], stops: [], connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } };
      this.nodes.push(node); return node;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    close() { this.change('closed'); return Promise.resolve(); }
  }
  const window = { AudioContext: mode === 'unsupported' ? undefined : AudioContext, performance: { now: () => now },
    setInterval: callback => { intervals.set(++nextInterval, callback); return nextInterval; }, clearInterval: id => intervals.delete(id),
    addEventListener: (event, fn) => { winEvents[event] = fn; }
  };
  const app = mount(document, window);
  const input = value => { elements.get('minutes').value = value; elements.get('minutes').events.input(); };
  return { app, document, window, elements, contexts, docEvents, winEvents, intervals, input,
    setMode(value) { mode = value; },
    advance(ms, audio = true) { now += ms; if (audio) for (const context of contexts) if (context.state === 'running') context.currentTime += ms / 1000; },
    click: id => elements.get(id).click(), get: id => elements.get(id),
    key(target, repeat = false) { const event = { key: ' ', repeat, target, preventDefault() { this.prevented = true; } }; gesture = true; docEvents.keydown(event); gesture = false; return event; }
  };
}

test('whole-minute range is 1–999, with clear invalid-input rejection', () => {
  for (const value of ['1', '25', '999', ' 2 ', '001']) expect(parseMinutes(value)).toBe(Number(value));
  for (const value of ['', ' ', '0', '-1', '1000', '99999999999999999', '1.5', '.5', '1e2', 'foo', 'NaN', 'Infinity', '0x10']) expect(() => parseMinutes(value)).toThrow('1 to 999');
});

test('MM:SS uses ceiling, includes zero and supports 999 minutes', () => {
  expect([0, 1, 999, 1000, 59999, 60000, 999 * 60000].map(formatTime)).toEqual(['00:00', '00:01', '00:01', '00:01', '01:00', '01:00', '999:00']);
});

test('deadline remains accurate without any interval callbacks', () => {
  let now = 0; const timer = new Timer(() => now); timer.start(1);
  now = 30123; expect(timer.timeLeft()).toBe(29877);
  now = 90000; expect(timer.timeLeft()).toBe(0);
});

test('pause/resume preserves remaining time instead of restarting', () => {
  let now = 0; const timer = new Timer(() => now); timer.start(2);
  now = 30123; timer.pause(); expect(timer.timeLeft()).toBe(89877);
  now = 90000; expect(timer.timeLeft()).toBe(89877);
  timer.start(2); now += 1000; expect(timer.timeLeft()).toBe(88877);
});

test('invalid UI input prevents audio and starting; correction clears the error', async () => {
  const f = fixture(); f.input('0'); f.click('start'); await flush();
  expect(f.app.timer.state).toBe('idle'); expect(f.contexts).toHaveLength(0);
  expect(f.get('minutes').attributes['aria-invalid']).toBe('true'); expect(f.get('minutes').focused).toBe(true);
  f.input('1'); f.click('start'); await flush();
  expect(f.app.timer.state).toBe('running'); expect(f.get('input-error').textContent).toBe('');
  expect(f.get('minutes').attributes['aria-invalid']).toBeUndefined();
});

test('audio is prepared in the user gesture and completion notes are scheduled in advance', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush();
  const context = f.contexts[0];
  expect(context.resumeGestures).toEqual([true]);
  expect(f.app.chime.alarm.map(({ oscillator }) => oscillator.starts[0])).toEqual([60, 60.25]);
  expect(f.app.chime.check[0].oscillator.starts).toEqual([0.01]);
  expect(f.get('minutes').disabled).toBe(true); expect(f.get('start').disabled).toBe(true); expect(f.get('pause').disabled).toBe(false);
});

test('completion resets configured display exactly once without scheduling another chime', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush();
  const context = f.contexts[0], count = context.nodes.length;
  f.advance(60000); f.app.tick();
  expect(f.app.timer.state).toBe('completed'); expect(f.get('timer').textContent).toBe('01:00');
  expect(f.get('status').textContent).toContain('Completed at 00:00'); expect(f.document.title).toContain('Time is up');
  expect(context.nodes.length).toBe(count); expect(f.app.chime.alarm).toHaveLength(2);
  f.advance(60000); f.app.tick(); expect(context.nodes.length).toBe(count);
  f.click('start'); await flush(); expect(f.app.timer.state).toBe('running'); expect(f.app.timer.timeLeft()).toBe(60000);
});

test('pausing cancels future notes; resuming schedules only remaining duration', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush();
  const previous = f.app.chime.alarm.map(record => record.oscillator);
  f.advance(10000); f.click('pause');
  expect(previous.every(node => node.disconnected && node.stops.at(-1) === undefined)).toBe(true);
  expect(f.app.timer.timeLeft()).toBe(50000); expect(f.app.chime.alarm).toHaveLength(0);
  f.advance(30000); f.click('start'); await flush();
  expect(f.app.chime.alarm[0].oscillator.starts[0]).toBe(90);
  expect(f.get('status').textContent).toBe('Running.');
});

test('editing a paused duration resets to the new configured value', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush(); f.advance(10000); f.click('pause'); f.input('2');
  expect(f.app.timer.state).toBe('idle'); expect(f.get('timer').textContent).toBe('02:00');
  f.click('start'); await flush(); expect(f.app.timer.timeLeft()).toBe(120000);
});

test('paused sound status reflects cancellation rather than a scheduled chime', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush(); f.click('pause');
  expect(f.app.chime.alarm).toHaveLength(0);
  expect(f.get('audio-status').textContent).toContain('No chime is scheduled while paused');
});

test('reset sound status invites a new start after cancelling the old schedule', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush(); f.click('pause'); f.input('2');
  expect(f.app.timer.state).toBe('idle'); expect(f.app.chime.alarm).toHaveLength(0);
  expect(f.get('audio-status').textContent).toContain('No chime scheduled. Start');
});

test('completed sound status describes completion without claiming audible playback', async () => {
  for (const mode of ['allowed', 'blocked']) {
    const f = fixture(mode); f.input('1'); f.click('start'); await flush(); f.advance(60000); f.app.tick();
    expect(f.app.timer.state).toBe('completed');
    expect(f.get('audio-status').textContent).toContain('Timer finished. If no chime was heard');
    expect(f.get('audio-status').textContent).not.toContain('Chime scheduled');
  }
});

for (const mode of ['blocked', 'constructor-error', 'unsupported', 'node-error']) {
  test(`${mode} audio keeps the visual countdown and completion working`, async () => {
    const f = fixture(mode); f.input('1'); f.click('start'); await flush();
    expect(f.app.timer.state).toBe('running'); expect(f.get('audio-status').textContent).toContain('Sound unavailable');
    f.advance(61000); f.app.tick(); expect(f.app.timer.state).toBe('completed'); expect(f.get('timer').textContent).toBe('01:00');
  });
}

test('an unresolved permission promise never stalls the timer or rings after completion', async () => {
  const f = fixture('pending'); f.input('1'); f.click('start');
  f.advance(60000); f.app.tick(); expect(f.app.timer.state).toBe('completed');
  f.contexts[0].resolveResume(); await flush(); expect(f.app.chime.alarm).toHaveLength(0);
});

test('denied then allowed audio recovers on pause/resume at the remaining deadline', async () => {
  const f = fixture('blocked'); f.input('1'); f.click('start'); await flush(); f.advance(10000); f.click('pause');
  f.setMode('allowed'); f.click('start'); await flush();
  expect(f.app.chime.alarm[0].oscillator.starts[0]).toBe(50);
  expect(f.get('audio-status').textContent).toContain('Chime scheduled'); expect(f.app.timer.timeLeft()).toBe(50000);
});

test('suspension cancels stale notes and restored audio uses the elapsed timer deadline', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush(); f.advance(10000);
  f.contexts[0].change('suspended'); expect(f.app.chime.alarm).toHaveLength(0);
  f.advance(20000); f.contexts[0].change('running');
  expect(f.app.timer.timeLeft()).toBe(30000); expect(f.app.chime.alarm[0].oscillator.starts[0]).toBe(40);
});

test('late readiness from an earlier start cannot rearm a paused timer', async () => {
  const f = fixture('pending'); f.input('1'); f.click('start'); f.click('pause');
  f.contexts[0].resolveResume(); await flush();
  expect(f.app.timer.state).toBe('paused'); expect(f.app.chime.alarm).toHaveLength(0); expect(f.app.chime.check).toHaveLength(0);
});

test('late completion after a stopped audio clock cancels the obsolete alarm', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush();
  f.advance(61000, false); f.app.tick(); expect(f.app.timer.state).toBe('completed'); expect(f.app.chime.alarm).toHaveLength(0);
});

test('hidden state does not pause; visibility resynchronizes display from deadline', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush();
  f.document.hidden = true; f.docEvents.visibilitychange(); f.advance(30123);
  f.document.hidden = false; f.docEvents.visibilitychange();
  expect(f.app.timer.state).toBe('running'); expect(f.get('timer').textContent).toBe('00:30');
});

test('Space works outside editable/native controls without double activation', async () => {
  const f = fixture(); f.input('1');
  expect(f.key(f.get('minutes')).prevented).toBeUndefined(); expect(f.app.timer.state).toBe('idle');
  expect(f.key(f.get('start')).prevented).toBeUndefined(); expect(f.app.timer.state).toBe('idle');
  expect(f.key({ tagName: 'BODY' }, true).prevented).toBeUndefined();
  expect(f.key({ tagName: 'BODY' }).prevented).toBe(true); await flush(); expect(f.app.timer.state).toBe('running');
  f.key({ tagName: 'BODY' }); expect(f.app.timer.state).toBe('paused'); expect(f.get('start').attributes['aria-label']).toBe('Resume timer');
});

test('navigation cleanup stops notes and timers; restoring the page does not duplicate polling', async () => {
  const f = fixture(); f.input('1'); f.click('start'); await flush(); f.advance(10000); f.winEvents.pagehide();
  expect(f.intervals.size).toBe(0); expect(f.app.chime.context).toBe(null); expect(f.app.timer.state).toBe('paused');
  f.winEvents.pageshow(); f.winEvents.pageshow(); expect(f.intervals.size).toBe(1);
});

test('standalone document has labels, live state, keyboard focus and no external resources', () => {
  expect(html).toContain('for="minutes"'); expect(html).toContain('role="timer" aria-live="off"');
  expect(html).toContain('role="status" aria-live="polite"'); expect(html).toContain('tabindex="0"');
  expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|new Notification|Notification.requestPermission/);
});
