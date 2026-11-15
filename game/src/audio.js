// Synthesised sound: every effect is built from WebAudio oscillators and filtered
// noise, so the game needs no audio files and works fully offline. The context is
// created lazily on the first user gesture (browsers block audio before that) and
// every call is a no-op until then. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx !== null) return ctx !== null && ctx.state === 'running';
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx !== null;
  }

  /** Resume (and create) the context from a user gesture. */
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone({ freq = 440, freqEnd = null, dur = 0.1, type = 'square', gain = 0.2, when = 0 }) {
    if (!ensure() || muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, gain = 0.3, filter = 1200, when = 0 }) {
    if (!ensure() || muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filter * 0.15), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone({ freq: 880, freqEnd: 220, dur: 0.09, type: 'square', gain: 0.12 });
    },
    enemyShoot() {
      tone({ freq: 320, freqEnd: 140, dur: 0.14, type: 'sawtooth', gain: 0.08 });
    },
    explosion(big = false) {
      noise({ dur: big ? 0.45 : 0.25, gain: big ? 0.4 : 0.25, filter: big ? 900 : 1600 });
      tone({ freq: 160, freqEnd: 40, dur: big ? 0.4 : 0.22, type: 'sine', gain: 0.3 });
    },
    pickup(combo = 0) {
      const base = 520 * 2 ** (Math.min(combo, 12) / 12);
      tone({ freq: base, dur: 0.07, type: 'sine', gain: 0.16 });
      tone({ freq: base * 1.5, dur: 0.09, type: 'sine', gain: 0.14, when: 0.05 });
    },
    hit() {
      noise({ dur: 0.3, gain: 0.35, filter: 700 });
      tone({ freq: 220, freqEnd: 55, dur: 0.3, type: 'sawtooth', gain: 0.25 });
    },
    dash() {
      noise({ dur: 0.18, gain: 0.18, filter: 3200 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.16, when: i * 0.07 }));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.18, when: i * 0.16 }));
    },
    start() {
      [262, 392, 523].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', gain: 0.15, when: i * 0.06 }));
    },
  };
}
