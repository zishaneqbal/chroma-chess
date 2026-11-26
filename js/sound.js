/**
 * Lightweight Web Audio API sound effects with distinct synthesized sounds
 * for each chess piece (Pawn, Knight, Bishop, Rook, Queen, King),
 * plus captures, castling, check, and game over.
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

  function playTone(freq, duration, type, gainVal, delay = 0, endFreq = null) {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  const PIECE_PROFILES = {
    P: () => {
      // Crisp, light wooden pawn tap
      playTone(460, 0.06, 'triangle', 0.14, 0, 290);
    },
    N: () => {
      // Playful two-step knight gallop
      playTone(330, 0.055, 'triangle', 0.13, 0, 270);
      playTone(495, 0.075, 'triangle', 0.14, 0.055, 390);
    },
    B: () => {
      // Smooth diagonal bishop shimmer
      playTone(520, 0.11, 'sine', 0.14, 0, 680);
      playTone(780, 0.08, 'sine', 0.06, 0.02);
    },
    R: () => {
      // Solid, heavy rook thud
      playTone(195, 0.11, 'triangle', 0.18, 0, 125);
      playTone(110, 0.09, 'sine', 0.14, 0.01, 80);
    },
    Q: () => {
      // Rich harmonic queen sweep
      playTone(440, 0.13, 'sine', 0.13, 0, 587);
      playTone(659, 0.13, 'triangle', 0.09, 0.015, 880);
    },
    K: () => {
      // Regal resonant king chime
      playTone(262, 0.14, 'triangle', 0.15, 0, 220);
      playTone(392, 0.14, 'sine', 0.1, 0.02, 330);
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
      // Punchy capture impact + subtle piece signature
      playTone(165, 0.11, 'sawtooth', 0.14, 0, 85);
      const fn = PIECE_PROFILES[pieceType] || PIECE_PROFILES.P;
      fn();
    },
    playCastle() {
      playTone(280, 0.08, 'triangle', 0.14, 0, 220);
      playTone(420, 0.1, 'triangle', 0.14, 0.075, 520);
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
