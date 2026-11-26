// Nusa Airlift — audio: everything is synthesised with WebAudio, no files.
// One clear job: engine drone, wind, ring chimes and landing thuds.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Engine: two detuned sawtooths through a low-pass filter.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 70;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 71.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a band-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 500;
    band.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(band);
    band.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return ctx;
  }

  function blip(freq, dur, type = 'sine', vol = 0.16) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; },
    isMuted() { return muted; },
    // Called every frame while flying: engine pitch follows throttle.
    update(throttle, speed, onGround) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(onGround && throttle < 0.05 ? 0.0 : 0.045 + throttle * 0.05, t, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(62 + throttle * 68 + speed * 0.12, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.00045), t, 0.2);
    },
    ring() { blip(880, 0.35, 'sine', 0.2); setTimeout(() => blip(1318, 0.4, 'sine', 0.16), 90); },
    thud() { blip(90, 0.25, 'triangle', 0.3); },
    crash() { blip(55, 0.7, 'sawtooth', 0.25); setTimeout(() => blip(40, 0.9, 'sawtooth', 0.2), 120); },
    click() { blip(660, 0.07, 'square', 0.08); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.5, 'sine', 0.18), i * 110)); },
  };
}
