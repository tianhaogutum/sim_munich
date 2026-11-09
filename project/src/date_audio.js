// Procedural sound for the Munich date; no assets, imports, or eager AudioContext.
// createAudio(engine?, story?) -> { update, handleKey, setMuted, isMuted, cue, dispose }.
// Call update after player movement. Route keys after storyUI and photo. Assign engine.audio
// to the returned object so either module can call engine.audio?.cue('tick' / 'shutter').
// All oscillators/noise share one master gain, including the generated reverb return.

const SILENCE = 0.0001;
const BPM = 90;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const STORAGE_KEY = 'lmu-date-audio-muted';
const CHORDS = [
  [50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 59, 61],
  [50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 64],
];
const MELODY = [
  [74, 78, 81, 78], [78, 74, 73, 69], [71, 74, 78, 74], [73, 76, 81, 76],
  [78, 81, 86, 81], [78, 74, 69, 73], [74, 78, 81, 78], [76, 73, 69, 74],
];
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Pure Web Audio scheduling: also accepts an OfflineAudioContext for numerical QA.
// Optional onVoice(source, envelope) lets the live mixer own teardown and diagnostics.
function tone(context, destination, midi, when, duration, peak, type = 'sine', onVoice) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const attack = Math.min(0.028, duration * 0.18);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency(midi), when);
  envelope.gain.setValueAtTime(SILENCE, when);
  envelope.gain.exponentialRampToValueAtTime(Math.max(SILENCE, peak), when + attack);
  envelope.gain.exponentialRampToValueAtTime(Math.max(SILENCE, peak * 0.32), when + duration * 0.38);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, when + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  onVoice?.(oscillator, envelope);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.015);
}

export function scheduleMusicBar(context, destination, when, barIndex = 0, stem = 'base', onVoice) {
  const index = ((barIndex % CHORDS.length) + CHORDS.length) % CHORDS.length;
  const chord = CHORDS[index];
  if (stem === 'base') {
    chord.forEach((note, i) => tone(context, destination, note, when + i * 0.025,
      BAR * 0.96, 0.22, 'sine', onVoice));
    MELODY[index].forEach((note, i) => tone(context, destination, note,
      when + (i + (i % 2 ? 0.045 : 0)) * BEAT, BEAT * 0.85, 0.24, 'triangle', onVoice));
  } else if (stem === 'photos') {
    // Airy pentatonic upper notes, lightly swung, bring a little sparkle to the album.
    for (let i = 0; i < 8; i++) tone(context, destination, chord[i % 4] + 24,
      when + (i * 0.5 + (i % 2 ? 0.035 : 0)) * BEAT, BEAT * 0.48, 0.07, 'sine', onVoice);
  } else if (stem === 'golden') {
    // Warm low root and a slower answering melody for the postcard and ending.
    tone(context, destination, chord[0] - 12, when, BAR * 0.96, 0.19, 'sine', onVoice);
    tone(context, destination, chord[2], when + BEAT, BEAT * 1.8, 0.12, 'sine', onVoice);
    tone(context, destination, chord[3], when + BEAT * 3, BEAT * 0.9, 0.10, 'triangle', onVoice);
  }
}

function noiseBuffer(context, seconds) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function impulseBuffer(context) {
  const length = Math.ceil(context.sampleRate * 1.65);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.7;
  }
  return buffer;
}

const countPhotos = state => {
  const photos = state?.photos;
  if (typeof photos === 'number') return photos;
  return photos ? Object.values(photos).filter(Boolean).length : 0;
};

export function createAudio(engine = {}, story = null) {
  const host = globalThis.window;
  const doc = globalThis.document;
  let disposed = false;
  let muted = false;
  let volume = 1;
  try { muted = globalThis.localStorage?.getItem(STORAGE_KEY) === 'true'; } catch { /* private browsing */ }
  let context = null, master = null, music = null, effects = null, fountain = null;
  let base = null, photos = null, golden = null;
  let unsubscribe = null, root = null, button = null;
  let stage = 'meet', previousState = null;
  try { previousState = story?.getState?.(); stage = previousState?.stage ?? stage; } catch { /* optional story */ }
  let lastX = Number(engine?.player?.pos?.x) || 0;
  let lastZ = Number(engine?.player?.pos?.z) || 0;
  let stepDistance = 0, nextStep = 0, stepSide = 0;
  let nextBar = 0, barIndex = 0, nextBird = 0;
  let nextWind = 0, wind = null, waterAmount = 0;
  let started = false, unavailable = false;
  let optInClick = false;
  const voices = new Set();
  const permanent = [];
  const counters = { steps: 0, birds: 0, bars: 0, cues: 0 };
  const cueTimes = Object.create(null);

  // Every transient disconnects as soon as it ends (also stopped by dispose).
  function ownVoice(source, ...nodes) {
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  function smooth(param, value, seconds = 0.15) {
    if (!context || !param) return;
    // cancelAndHold avoids stale ramps jumping when mute/stage changes happen quickly.
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(context.currentTime);
    else param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  }

  function applyStage() {
    if (!context) return;
    const isGolden = stage === 'postcard' || stage === 'done';
    smooth(base.gain, isGolden ? 0.78 : 1, 0.7);
    smooth(photos.gain, stage === 'photos' ? 1 : 0, 0.7);
    smooth(golden.gain, isGolden ? 1 : 0, 0.9);
    smooth(music.frequency, isGolden ? 2100 : stage === 'photos' ? 3800 : 2800, 0.8);
  }

  function renderIndicator() {
    if (!button) return;
    const label = unavailable ? '声音不可用' : muted ? '声音已关' : started ? '声音已开' : '轻触开启声音';
    button.textContent = `${muted || unavailable ? '♫' : '♪'}  ${label}  ·  M`;
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? '开启声音 (M)' : '静音 (M)');
    button.title = 'M · 切换音乐与环境声';
    root.dataset.muted = String(muted);
    root.dataset.audioState = unavailable ? 'unavailable' : context?.state ?? 'waiting';
  }

  function noiseLoop(buffer, type, hz, q, volume) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer; source.loop = true;
    filter.type = type; filter.frequency.value = hz; filter.Q.value = q;
    gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(master);
    permanent.push(source, filter, gain);
    source.start(0, Math.random() * buffer.duration);
    return gain;
  }

  function disconnectGraph() {
    for (const source of voices) { try { source.stop(); source.disconnect(); } catch { /* already ended */ } }
    voices.clear();
    for (const node of permanent) {
      try { node.stop?.(); node.disconnect(); } catch { /* already stopped */ }
    }
    permanent.length = 0;
  }

  function unlock(event) {
    if (disposed) return;
    if (!started && !muted && event?.target?.nodeType && button?.contains(event.target) &&
        (event.type === 'pointerdown' || event.key === 'Enter' || event.key === ' ')) optInClick = true;
    host?.removeEventListener('pointerdown', unlock, true);
    host?.removeEventListener('keydown', unlock, true);
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) { unavailable = true; renderIndicator(); return; }
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0;
        master.connect(context.destination);
        music = context.createBiquadFilter(); music.type = 'lowpass'; music.Q.value = 0.5;
        music.connect(master);
        const reverb = context.createConvolver(); reverb.buffer = impulseBuffer(context);
        const wet = context.createGain(); wet.gain.value = 0.16;
        music.connect(reverb); reverb.connect(wet); wet.connect(master);
        base = context.createGain(); photos = context.createGain(); golden = context.createGain();
        base.gain.value = 1; photos.gain.value = 0; golden.gain.value = 0;
        base.connect(music); photos.connect(music); golden.connect(music);
        effects = context.createGain(); effects.gain.value = 0.55; effects.connect(master);
        permanent.push(master, music, reverb, wet, base, photos, golden, effects);
        const noise = noiseBuffer(context, 4);
        wind = noiseLoop(noise, 'lowpass', 550, 0.3, 0.065);
        fountain = noiseLoop(noise, 'bandpass', 1700, 0.65, 0);
        // Same cached noise powers the short, filtered stone impacts.
        effects.noiseBuffer = noise;
        nextBar = context.currentTime + 0.06;
        nextBird = context.currentTime + 3 + Math.random() * 5;
        applyStage();
        smooth(master.gain, muted ? 0 : 0.62 * volume, 0.12);
      }
      // Do not await: browsers can leave resume pending until a trusted gesture arrives.
      context.resume()?.catch(() => {});
      started = true;
      context.onstatechange = () => {
        if (disposed) return;
        renderIndicator();
        // Mobile tab interruptions can suspend a previously unlocked context.
        if (context.state === 'suspended' || context.state === 'interrupted') armGesture();
      };
      if (context.state !== 'running') armGesture();
      renderIndicator();
    } catch {
      unavailable = true;
      disconnectGraph();
      try { context?.close()?.catch(() => {}); } catch { /* unsupported context */ }
      renderIndicator();
    }
  }

  function armGesture() {
    host?.addEventListener('pointerdown', unlock, { once: true, capture: true });
    host?.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  function setMuted(value) {
    if (disposed) return;
    muted = Boolean(value);
    try { globalThis.localStorage?.setItem(STORAGE_KEY, String(muted)); } catch { /* storage is optional */ }
    if (master) smooth(master.gain, muted ? 0 : 0.62 * volume, 0.045);
    // Begin the current progression at a fresh bar after a long silent interval.
    if (!muted && context && nextBar < context.currentTime) nextBar = context.currentTime + 0.06;
    renderIndicator();
  }

  function setVolume(value) {
    if (disposed || !Number.isFinite(value)) return;
    volume = clamp(value, 0, 1);
    if (master) smooth(master.gain, muted ? 0 : 0.62 * volume, 0.045);
  }

  function toggleMute() {
    setMuted(!muted);
    try { engine?.toast?.(muted ? '♫ 声音已关闭 · M 开启' : '♪ 声音已开启 · M 静音', 1800); } catch { /* optional HUD */ }
  }

  function cue(name) {
    if (disposed || muted || !effects || context?.state !== 'running') return;
    const now = context.currentTime;
    // Story and UI may request the same cue for one event. Avoid accidental double attacks.
    if (cueTimes[name] != null && now - cueTimes[name] < 0.085) return;
    cueTimes[name] = now;
    const start = now + 0.008;
    const ping = (note, offset, length, gain, type = 'sine') =>
      tone(context, effects, note, start + offset, length, gain, type, ownVoice);
    switch (name) {
      case 'tick': ping(81, 0, 0.045, 0.055); break;
      case 'choose': ping(74, 0, 0.12, 0.12); ping(81, 0.065, 0.2, 0.1); break;
      case 'stage': [74, 78, 81].forEach((n, i) => ping(n, i * 0.11, 0.42, 0.14)); break;
      case 'photo': ping(86, 0, 0.22, 0.12); ping(90, 0.09, 0.34, 0.1); break;
      case 'shutter': impact(0.13, 2700, 0.04); break;
      case 'collect': [81, 86, 90, 93].forEach((n, i) => ping(n, i * 0.075, 0.38, 0.12)); break;
      case 'ending': [62, 66, 69, 74, 78, 81].forEach((n, i) => ping(n, i * 0.12, 1.1, 0.11)); break;
      default: return;
    }
    counters.cues++;
  }

  function impact(volume, hz, duration) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const now = context.currentTime + 0.005;
    source.buffer = effects.noiseBuffer;
    filter.type = 'bandpass'; filter.frequency.value = hz; filter.Q.value = 0.7;
    envelope.gain.setValueAtTime(SILENCE, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + 0.005);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, now + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(effects);
    ownVoice(source, filter, envelope);
    source.start(now, Math.random() * 3); source.stop(now + duration + 0.01);
  }

  function birds(now) {
    for (let i = 0; i < 3; i++) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const t = now + i * 0.16;
      const hz = 2300 + Math.random() * 800;
      oscillator.frequency.setValueAtTime(hz, t);
      oscillator.frequency.exponentialRampToValueAtTime(hz * 1.32, t + 0.035);
      oscillator.frequency.exponentialRampToValueAtTime(hz * 0.9, t + 0.12);
      envelope.gain.setValueAtTime(SILENCE, t);
      envelope.gain.exponentialRampToValueAtTime(0.024, t + 0.012);
      envelope.gain.exponentialRampToValueAtTime(SILENCE, t + 0.13);
      oscillator.connect(envelope); envelope.connect(effects);
      ownVoice(oscillator, envelope);
      oscillator.start(t); oscillator.stop(t + 0.14);
    }
    counters.birds++;
  }

  function update(dt, et) {
    if (disposed) return;
    void et;
    const pos = engine?.player?.pos;
    const x = Number.isFinite(pos?.x) ? pos.x : lastX;
    const z = Number.isFinite(pos?.z) ? pos.z : lastZ;
    const distance = Math.hypot(x - lastX, z - lastZ);
    lastX = x; lastZ = z;
    if (!context || context.state !== 'running') { stepDistance = 0; return; }
    const now = context.currentTime;
    let nearest = Infinity;
    const fountains = engine?.route?.FOUNTAINS;
    if (Array.isArray(fountains)) for (let i = 0; i < fountains.length; i++) {
      const f = fountains[i];
      if (Number.isFinite(f?.x) && Number.isFinite(f?.z)) nearest = Math.min(nearest, Math.hypot(x - f.x, z - f.z));
    }
    const proximity = clamp((40 - nearest) / 32, 0, 1);
    const target = 0.19 * proximity * proximity * (3 - 2 * proximity);
    if (Math.abs(target - waterAmount) > 0.001) {
      waterAmount = target; smooth(fountain.gain, target, 0.3);
    }
    if (muted || doc?.hidden) { stepDistance = 0; return; }
    // Schedule one bar ahead; never catch up with a burst after a background tab resumes.
    if (nextBar < now - 0.2) nextBar = now + 0.06;
    if (nextBar < now + 0.2) {
      scheduleMusicBar(context, base, nextBar, barIndex, 'base', ownVoice);
      scheduleMusicBar(context, photos, nextBar, barIndex, 'photos', ownVoice);
      scheduleMusicBar(context, golden, nextBar, barIndex, 'golden', ownVoice);
      barIndex++; counters.bars++; nextBar += BAR;
    }
    if (now >= nextBird) { birds(now + 0.01); nextBird = now + 8 + Math.random() * 12; }
    if (now >= nextWind) { smooth(wind.gain, 0.045 + Math.random() * 0.03, 1.8); nextWind = now + 3; }
    const validDelta = Number.isFinite(dt) && dt > 0 && dt <= 0.25;
    const speed = validDelta ? distance / dt : 0;
    let locked = false;
    try { locked = Boolean(engine?.isLocked?.()); } catch { locked = true; }
    // Teleports, lock/unlock and missing positions must never produce a footstep burst.
    if (locked || speed < 0.3 || speed > 13) { stepDistance = 0; return; }
    stepDistance += distance;
    const running = speed > 6;
    const stride = running ? 2.35 : 1.8;
    if (stepDistance >= stride && now >= nextStep) {
      impact(running ? 0.20 : 0.14, stepSide++ % 2 ? 700 : 580, running ? 0.085 : 0.105);
      counters.steps++; stepDistance %= stride; nextStep = now + 0.17;
    }
  }

  function onStory(state, prev, event) {
    if (disposed || !state) return;
    const before = prev ?? previousState;
    const changed = state.stage !== stage;
    stage = state.stage ?? stage;
    applyStage();
    if (changed) cue('stage');
    if (countPhotos(state) > countPhotos(before)) cue('photo');
    if (event?.type === 'CHOOSE') cue('choose');
    if (event?.type === 'COLLECT' && !before?.collected?.[event.id] && state.collected?.[event.id]) cue('collect');
    if (changed && (stage === 'postcard' || stage === 'done')) cue('ending');
    previousState = state;
  }

  if (doc?.body) {
    root = doc.createElement('div'); root.id = 'date-audio-root';
    root.style.cssText = 'position:fixed;right:20px;bottom:46px;z-index:24;pointer-events:none';
    button = doc.createElement('button'); button.type = 'button';
    button.style.cssText = 'display:block;padding:7px 12px;border:1px solid rgba(245,216,120,.28);' +
      'border-radius:14px;background:rgba(8,6,20,.76);color:#F5D878;font:12px/1.4 Nunito,sans-serif;' +
      'letter-spacing:.035em;cursor:pointer;pointer-events:auto;backdrop-filter:blur(8px)';
    button.onclick = () => {
      if (optInClick) { optInClick = false; return; }
      // First click is an explicit opt-in when the initial state was unmuted.
      if (!started && !muted) unlock(); else toggleMute();
    };
    root.appendChild(button); doc.body.appendChild(root); renderIndicator();
  }
  try { unsubscribe = story?.subscribe?.(onStory); } catch { /* optional story */ }
  armGesture();

  return {
    update, setMuted, setVolume, isMuted: () => muted, cue,
    handleKey(k, event) {
      if (disposed || typeof k !== 'string' || k.toLowerCase() !== 'm') return false;
      if (event?.ctrlKey || event?.metaKey || event?.altKey) return false;
      if (!event?.repeat) toggleMute();
      return true;
    },
    // Read-only diagnostics; the native context and nodes stay owned by this module.
    getDebugState: () => ({ contextState: context?.state ?? 'uninitialized', muted, disposed,
      stage, volume, activeVoices: voices.size, permanentNodes: permanent.length,
      masterGain: master?.gain.value ?? 0, fountainGain: fountain?.gain.value ?? 0,
      fountainTarget: waterAmount, baseGain: base?.gain.value ?? 0,
      photosGain: photos?.gain.value ?? 0, goldenGain: golden?.gain.value ?? 0, ...counters }),
    dispose() {
      if (disposed) return;
      disposed = true;
      host?.removeEventListener('pointerdown', unlock, true);
      host?.removeEventListener('keydown', unlock, true);
      try { if (typeof unsubscribe === 'function') unsubscribe(); } catch { /* optional subscription */ }
      if (context) {
        context.onstatechange = null;
        // Let the master release before closing, to avoid cutting a nonzero waveform.
        smooth(master?.gain, 0, 0.01);
        const finish = () => {
          disconnectGraph();
          try { context.close()?.catch(() => {}); } catch { /* already closed */ }
        };
        if (context.state === 'running') globalThis.setTimeout(finish, 80);
        else finish();
      }
      if (button) button.onclick = null;
      root?.remove();
    },
  };
}
