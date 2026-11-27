/**
 * Acoustic Web Audio API sound synthesizer for ChromaChess.
 * Combines filtered noise transients (carved wood / felt slide) with
 * resonant board-body thuds so each piece has a realistic, tactile sound.
 */
(function (global) {
  let audioCtx = null;
  let masterOut = null;
  let noiseBuffer = null;
  let enabled = true;

  function ensureContext() {
    if (!enabled) return null;
    if (!audioCtx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 1.6;
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
        compressor.knee.setValueAtTime(10, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(5, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.12, audioCtx.currentTime);
        masterGain.connect(compressor);
        compressor.connect(audioCtx.destination);
        masterOut = masterGain;

        // Pre-build a 0.25s white-noise buffer for acoustic wood & felt textures
        const len = Math.floor(audioCtx.sampleRate * 0.25);
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playWoodBurst(centerFreq, q, duration, gainVal, delay = 0, filterType = 'bandpass') {
    const ctx = ensureContext();
    if (!ctx || !masterOut || !noiseBuffer) return;
    const now = ctx.currentTime + delay;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(centerFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterOut);

    src.start(now);
    src.stop(now + duration + 0.01);
  }

  function playBodyThud(startFreq, endFreq, duration, gainVal, delay = 0, wave = 'sine') {
    const ctx = ensureContext();
    if (!ctx || !masterOut) return;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(masterOut);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function playChime(freq, duration, gainVal, delay = 0) {
    const ctx = ensureContext();
    if (!ctx || !masterOut) return;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(masterOut);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  const PIECE_PROFILES = {
    P: () => {
      // Light, crisp wooden "tock"
      playWoodBurst(1750, 4.2, 0.032, 0.75, 0);
      playBodyThud(290, 115, 0.05, 0.36, 0);
    },
    N: () => {
      // Distinctive two-step wooden horse-hoof "clip-clop"
      playWoodBurst(1250, 3.8, 0.028, 0.68, 0);
      playBodyThud(240, 95, 0.045, 0.34, 0);
      playWoodBurst(1600, 4.0, 0.032, 0.78, 0.072);
      playBodyThud(310, 120, 0.05, 0.38, 0.072);
    },
    B: () => {
      // Smooth felt-pad slide followed by a clean hardwood tap
      playWoodBurst(2600, 1.8, 0.055, 0.25, 0, 'bandpass');
      playWoodBurst(2100, 4.5, 0.03, 0.72, 0.028);
      playBodyThud(320, 130, 0.055, 0.34, 0.028);
    },
    R: () => {
      // Deep, heavy, solid tower "thunk"
      playWoodBurst(680, 2.8, 0.045, 0.85, 0);
      playBodyThud(165, 58, 0.085, 0.56, 0, 'triangle');
    },
    Q: () => {
      // Authoritative weighted crown clack + subtle resonant ring
      playWoodBurst(1150, 3.2, 0.04, 0.82, 0);
      playWoodBurst(2450, 4.5, 0.025, 0.45, 0.005);
      playBodyThud(220, 80, 0.075, 0.48, 0);
    },
    K: () => {
      // Heavy, weighted-base royal "thud-tock"
      playWoodBurst(880, 3.0, 0.042, 0.82, 0);
      playBodyThud(190, 65, 0.085, 0.52, 0);
    }
  };

  const ChessSound = {
    isEnabled() {
      return enabled;
    },
    setEnabled(val) {
      enabled = Boolean(val);
    },
    playMove(pieceType = 'P') {
      const fn = PIECE_PROFILES[pieceType] || PIECE_PROFILES.P;
      fn();
    },
    playCapture(pieceType = 'P') {
      // Sharp two-piece collision snap + heavy board knock + piece texture
      playWoodBurst(3200, 2.2, 0.035, 0.85, 0);
      playWoodBurst(850, 2.5, 0.05, 0.75, 0.012);
      playBodyThud(170, 52, 0.09, 0.55, 0.01, 'triangle');
      const fn = PIECE_PROFILES[pieceType] || PIECE_PROFILES.P;
      fn();
    },
    playCastle() {
      // Felt slide + two quick solid piece placements (King & Rook)
      playWoodBurst(2200, 1.5, 0.06, 0.25, 0);
      playWoodBurst(950, 3.2, 0.04, 0.78, 0.02);
      playBodyThud(200, 72, 0.07, 0.46, 0.02);
      playWoodBurst(700, 3.0, 0.045, 0.84, 0.11);
      playBodyThud(165, 60, 0.08, 0.5, 0.11, 'triangle');
    },
    playCheck() {
      // Crisp wooden knock + unmistakable harmonic alert chime
      playWoodBurst(1400, 3.5, 0.035, 0.65, 0);
      playBodyThud(240, 90, 0.06, 0.4, 0);
      playChime(880, 0.18, 0.34, 0.02);
      playChime(1318.5, 0.22, 0.28, 0.09);
    },
    playGameOver() {
      // Warm 4-note chord resolution (C5 - E5 - G5 - C6)
      playChime(523.25, 0.25, 0.34, 0);
      playChime(659.25, 0.25, 0.34, 0.09);
      playChime(783.99, 0.28, 0.34, 0.18);
      playChime(1046.5, 0.45, 0.38, 0.27);
    }
  };

  global.ChessSound = ChessSound;
})(typeof window !== 'undefined' ? window : globalThis);
