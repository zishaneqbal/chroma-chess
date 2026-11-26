/**
 * Lightweight Web Audio API sound effects for moves, captures, checks, and game end.
 */
(function (global) {
  let audioCtx = null;
  let enabled = true;

  function ensureContext() {
    if (!enabled) return null;
    if (!audioCtx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, gainVal, delay = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  const ChessSound = {
    isEnabled() {
      return enabled;
    },
    setEnabled(val) {
      enabled = Boolean(val);
    },
    playMove() {
      playTone(320, 0.08, 'triangle', 0.14);
    },
    playCapture() {
      playTone(190, 0.12, 'sawtooth', 0.14);
      playTone(130, 0.1, 'triangle', 0.12, 0.03);
    },
    playCastle() {
      playTone(300, 0.07, 'triangle', 0.12);
      playTone(420, 0.09, 'triangle', 0.12, 0.07);
    },
    playCheck() {
      playTone(580, 0.14, 'sine', 0.16);
      playTone(760, 0.14, 'sine', 0.12, 0.08);
    },
    playGameOver() {
      playTone(440, 0.14, 'triangle', 0.15, 0);
      playTone(554, 0.14, 'triangle', 0.15, 0.12);
      playTone(659, 0.28, 'triangle', 0.18, 0.24);
    }
  };

  global.ChessSound = ChessSound;
})(typeof window !== 'undefined' ? window : globalThis);
