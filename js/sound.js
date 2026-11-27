/**
 * Rich Acoustic PCM-WAV Synthesizer for ChromaChess.
 * Renders 44.1kHz 16-bit WAV clips with carved-wood inharmonic overtones,
 * felt-slide textures, and distinct per-piece acoustic signatures.
 */
(function (global) {
  const SAMPLE_RATE = 44100;
  let enabled = true;
  let initialized = false;
  let keepAliveAudio = null;
  const clipUrls = {};

  function encodeWav(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function renderClip(durationSec, fn) {
    const len = Math.floor(SAMPLE_RATE * durationSec);
    const samples = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      samples[i] = fn(i / SAMPLE_RATE);
    }
    return encodeWav(samples);
  }

  // Carved-wood knock with fundamental + inharmonic wooden overtones
  function woodKnock(t, startFreq, endFreq, decay, amp) {
    if (t < 0) return 0;
    const freq = endFreq + (startFreq - endFreq) * Math.exp(-t * 42);
    const attack = Math.min(1, t / 0.0022);
    const env = attack * Math.exp(-t * decay);
    const body = Math.sin(2 * Math.PI * freq * t);
    const overtone1 = Math.sin(2 * Math.PI * freq * 2.13 * t) * Math.exp(-t * decay * 1.6) * 0.35;
    const overtone2 = Math.sin(2 * Math.PI * freq * 3.41 * t) * Math.exp(-t * decay * 2.4) * 0.16;
    return (body + overtone1 + overtone2) * env * amp;
  }

  // Soft felt-base slide texture
  function feltSlide(t, duration, amp) {
    if (t < 0 || t > duration) return 0;
    const env = Math.sin((Math.PI * t) / duration);
    // Smooth deterministic high-mid texture
    const tex =
      Math.sin(2 * Math.PI * 1950 * t) * 0.4 +
      Math.sin(2 * Math.PI * 2740 * t) * 0.35 +
      Math.sin(2 * Math.PI * 3580 * t) * 0.25;
    return tex * env * amp;
  }

  function chimeTone(t, freq, decay, amp) {
    if (t < 0) return 0;
    const env = Math.min(1, t / 0.008) * Math.exp(-t * decay);
    return (
      (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 2 * t) * 0.22) *
      env *
      amp
    );
  }

  const PIECE_GENERATORS = {
    // Pawn: nimble, light, crisp wooden "tock"
    P: (t) => woodKnock(t, 470, 175, 44, 0.62) + woodKnock(t, 1180, 420, 85, 0.18),

    // Knight: unmistakable two-beat wooden horse-hoof "clip-clop"
    N: (t) =>
      woodKnock(t, 340, 130, 46, 0.54) +
      woodKnock(t - 0.085, 500, 195, 40, 0.64),

    // Bishop: smooth felt-pad diagonal glide into a bright crystalline tap
    B: (t) =>
      feltSlide(t, 0.042, 0.12) +
      woodKnock(t - 0.025, 620, 260, 34, 0.52) +
      chimeTone(t - 0.025, 1240, 28, 0.12),

    // Rook: deep, heavy, solid stone/hardwood "thunk"
    R: (t) =>
      woodKnock(t, 190, 62, 27, 0.7) +
      woodKnock(t, 98, 45, 22, 0.38),

    // Queen: regal felt sweep + rich dual-octave crown clack + warm shimmer
    Q: (t) =>
      feltSlide(t, 0.036, 0.11) +
      woodKnock(t - 0.018, 390, 140, 30, 0.58) +
      woodKnock(t - 0.018, 780, 300, 42, 0.26) +
      chimeTone(t - 0.02, 1174.66, 22, 0.11),

    // King: heavy, weighted-base royal "thud-tock"
    K: (t) =>
      woodKnock(t, 230, 78, 26, 0.68) +
      woodKnock(t, 510, 195, 42, 0.24) +
      chimeTone(t, 660, 24, 0.09)
  };

  function buildClips() {
    if (initialized || typeof Blob === 'undefined' || typeof URL === 'undefined') return;
    initialized = true;

    // Silent 0.5s WAV to keep Bluetooth TWS A2DP active
    const silentSamples = new Float32Array(Math.floor(SAMPLE_RATE * 0.5));
    keepAliveAudio = new Audio(encodeWav(silentSamples));
    keepAliveAudio.loop = true;
    keepAliveAudio.volume = 0.01;

    // Move & capture clips per piece
    for (const [piece, gen] of Object.entries(PIECE_GENERATORS)) {
      const dur = piece === 'N' ? 0.21 : piece === 'R' || piece === 'K' || piece === 'Q' ? 0.18 : 0.14;
      clipUrls[piece] = renderClip(dur, gen);

      clipUrls['cap_' + piece] = renderClip(dur + 0.03, (t) =>
        woodKnock(t, 1450, 320, 72, 0.36) +
        woodKnock(t, 240, 68, 28, 0.52) +
        gen(t - 0.014) * 0.78
      );
    }

    // Castle: felt slide + King & Rook sequential knocks
    clipUrls.castle = renderClip(0.24, (t) =>
      feltSlide(t, 0.04, 0.1) +
      woodKnock(t - 0.015, 270, 95, 34, 0.58) +
      woodKnock(t - 0.105, 195, 68, 28, 0.66)
    );

    // Check: crisp knock + unmistakable two-tone harmonic bell
    clipUrls.check = renderClip(0.32, (t) =>
      woodKnock(t, 360, 130, 36, 0.5) +
      chimeTone(t - 0.012, 880, 13, 0.26) +
      chimeTone(t - 0.075, 1174.66, 11, 0.26)
    );

    // Game Over: warm 4-note chord resolution
    clipUrls.gameover = renderClip(0.58, (t) => {
      const notes = [
        [0, 523.25],
        [0.09, 659.25],
        [0.18, 783.99],
        [0.27, 1046.5]
      ];
      let sum = 0;
      for (const [start, freq] of notes) {
        if (t >= start) {
          sum += chimeTone(t - start, freq, 7.5, 0.24);
        }
      }
      return sum;
    });
  }

  function ensureKeepAlive() {
    buildClips();
    if (enabled && keepAliveAudio && keepAliveAudio.paused) {
      keepAliveAudio.play().catch(() => {});
    }
  }

  if (typeof window !== 'undefined') {
    const unlock = () => {
      ensureKeepAlive();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  function playClip(key) {
    if (!enabled || typeof Audio === 'undefined') return;
    ensureKeepAlive();
    const url = clipUrls[key] || clipUrls.P;
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.92;
    audio.play().catch(() => {});
  }

  const ChessSound = {
    isEnabled() {
      return enabled;
    },
    setEnabled(val) {
      enabled = Boolean(val);
      if (keepAliveAudio) {
        if (enabled) keepAliveAudio.play().catch(() => {});
        else keepAliveAudio.pause();
      }
    },
    playMove(pieceType = 'P') {
      playClip(clipUrls[pieceType] ? pieceType : 'P');
    },
    playCapture(pieceType = 'P') {
      const key = clipUrls['cap_' + pieceType] ? 'cap_' + pieceType : 'cap_P';
      playClip(key);
    },
    playCastle() {
      playClip('castle');
    },
    playCheck() {
      playClip('check');
    },
    playGameOver() {
      playClip('gameover');
    }
  };

  global.ChessSound = ChessSound;
})(typeof window !== 'undefined' ? window : globalThis);
