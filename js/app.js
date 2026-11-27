/**
 * ChromaChess UI Controller
 * Manages board rendering, drag-and-drop / click-to-move, themes,
 * single-player AI turns, 2-player local multiplayer, promotion, and history.
 */
(function () {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const PIECE_MAT_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const INITIAL_CLOCK_SECONDS = 600; // 10 minutes per player

  const engine = new window.ChessEngine();

  const state = {
    mode: 'ai',          // 'ai' | 'pvp'
    pvpType: 'offline',  // 'offline' | 'online'
    difficulty: 'medium', // 'easy' | 'medium' | 'hard'
    timeControl: INITIAL_CLOCK_SECONDS, // 180 | 300 | 600 | 0 (off)
    humanColor: 'w',      // 'w' | 'b' (used in AI mode)
    onlineColor: 'w',     // 'w' | 'b' (used in 2P online mode)
    onlineConnected: false,
    opponentName: 'Opponent',
    speakerEnabled: true,
    clocks: { w: INITIAL_CLOCK_SECONDS, b: INITIAL_CLOCK_SECONDS },
    clockInterval: null,
    flipped: false,
    selected: null,       // { r, c }
    legalForSelected: [],
    lastMove: null,       // { fromR, fromC, toR, toC }
    slideMove: null,      // { fromR, fromC, toR, toC }
    pendingPromotion: null, // { fromR, fromC, toR, toC }
    aiThinking: false,
    gameOver: false,
    aiTimer: null,
    reactionTimer: null
  };

  // DOM Elements
  const boardEl = document.getElementById('chessboard');
  const difficultyGroup = document.getElementById('difficulty-group');
  const pvpTypeGroup = document.getElementById('pvp-type-group');
  const sideChoiceCard = document.getElementById('side-choice-card');
  const onlineCard = document.getElementById('online-card');
  const connBadge = document.getElementById('conn-badge');
  const onlineSetupView = document.getElementById('online-setup-view');
  const onlineActiveView = document.getElementById('online-active-view');
  const displayGameId = document.getElementById('display-game-id');
  const onlineHint = document.getElementById('online-hint');
  const inputGameId = document.getElementById('input-game-id');
  const inputPlayerName = document.getElementById('input-player-name');
  const promoModal = document.getElementById('promotion-modal');
  const promoOptions = document.getElementById('promo-options');
  const gameoverModal = document.getElementById('gameover-modal');
  const gameoverBadge = document.getElementById('gameover-badge');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverSubtitle = document.getElementById('gameover-subtitle');

  const topNameEl = document.getElementById('top-player-name');
  const topMetaEl = document.getElementById('top-player-meta');
  const topAvatarEl = document.getElementById('top-avatar');
  const topCapturedEl = document.getElementById('top-captured');
  const topClockEl = document.getElementById('top-clock');
  const topTurnPill = document.getElementById('top-turn-pill');

  const bottomNameEl = document.getElementById('bottom-player-name');
  const bottomMetaEl = document.getElementById('bottom-player-meta');
  const bottomAvatarEl = document.getElementById('bottom-avatar');
  const bottomCapturedEl = document.getElementById('bottom-captured');
  const bottomClockEl = document.getElementById('bottom-clock');
  const bottomTurnPill = document.getElementById('bottom-turn-pill');

  const voiceControlsEl = document.getElementById('voice-controls');
  const btnVoiceMic = document.getElementById('btn-voice-mic');
  const voiceMicIcon = document.getElementById('voice-mic-icon');
  const voiceMicLabel = document.getElementById('voice-mic-label');
  const btnVoiceSpeaker = document.getElementById('btn-voice-speaker');
  const voiceSpeakerIcon = document.getElementById('voice-speaker-icon');
  const voiceSpeakerLabel = document.getElementById('voice-speaker-label');
  const remoteVoiceAudio = document.getElementById('remote-voice-audio');

  const statusDot = document.getElementById('status-dot');
  const statusTitle = document.getElementById('status-title');
  const statusDetail = document.getElementById('status-detail');
  const moveListEl = document.getElementById('move-list');
  const moveCountEl = document.getElementById('move-count');

  const btnUndo = document.getElementById('btn-undo');
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  const soundLabel = document.getElementById('sound-label');
  const confettiCanvas = document.getElementById('confetti-canvas');
  const reactionToast = document.getElementById('reaction-toast');
  const reactionBar = document.getElementById('reaction-bar');
  const drawOfferBanner = document.getElementById('draw-offer-banner');
  const onlineMatchActions = document.getElementById('online-match-actions');

  // Mobile & Tablet Drawer & Slots (<= 960px)
  const mobileQuery = window.matchMedia('(max-width: 960px)');
  const controlsBar = document.getElementById('controls-bar');
  const actionsCard = document.querySelector('.actions-card');
  const sidePanel = document.querySelector('.side-panel');
  const historyCard = document.querySelector('.history-card');
  const bottomPlayerBar = document.getElementById('bottom-player-bar');
  const onlineActiveViewEl = document.getElementById('online-active-view');
  const roomStatusDot = document.getElementById('room-status-dot');
  const modeGroupEl = document.getElementById('mode-group');
  const themeGroupEl = document.getElementById('theme-group');
  const timeGroupEl = document.getElementById('time-group');
  const btnNewGameEl = document.getElementById('btn-new-game');
  const btnFlipEl = document.getElementById('btn-flip');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileDrawerBody = document.getElementById('mobile-drawer-body');
  const mobileDrawerBackdrop = document.getElementById('mobile-drawer-backdrop');
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const btnMobileClose = document.getElementById('btn-mobile-close');
  const mobileOnlineTopSlot = document.getElementById('mobile-online-top-slot');
  const mobileReactionTopSlot = document.getElementById('mobile-reaction-top-slot');

  function isHumanTurn() {
    if (state.gameOver || state.aiThinking || state.pendingPromotion) return false;
    if (state.mode === 'pvp') {
      if (state.pvpType === 'online') {
        return state.onlineConnected && engine.turn === state.onlineColor;
      }
      return true;
    }
    return engine.turn === state.humanColor;
  }

  function stopClock() {
    if (state.clockInterval) {
      clearInterval(state.clockInterval);
      state.clockInterval = null;
    }
  }

  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateClockUI() {
    const topColor = state.flipped ? 'w' : 'b';
    const bottomColor = state.flipped ? 'b' : 'w';
    const running = !state.gameOver && engine.moveList.length > 0;

    const applyClock = (el, color) => {
      const isComputer = state.mode === 'ai' && color !== state.humanColor;
      const timerOff = state.timeControl === 0;
      el.classList.toggle('hidden', isComputer || timerOff);
      if (isComputer || timerOff) return;

      const secs = state.clocks[color];
      el.textContent = formatClock(secs);
      el.classList.remove('active', 'low', 'critical');
      if (running && engine.turn === color) el.classList.add('active');
      if (secs <= 20) el.classList.add('critical');
      else if (secs <= 60) el.classList.add('low');
    };

    applyClock(topClockEl, topColor);
    applyClock(bottomClockEl, bottomColor);
  }

  function ensureClockRunning() {
    if (state.timeControl === 0 || state.clockInterval || state.gameOver || engine.moveList.length === 0) return;
    state.clockInterval = setInterval(() => {
      if (state.gameOver) {
        stopClock();
        return;
      }
      const turn = engine.turn;
      if (state.mode === 'ai' && turn !== state.humanColor) return;
      state.clocks[turn] = Math.max(0, state.clocks[turn] - 1);
      updateClockUI();

      if (state.clocks[turn] === 0) {
        stopClock();
        if (state.mode === 'pvp' && state.pvpType === 'online' && state.onlineConnected) {
          online.send({ type: 'timeout', clocks: { ...state.clocks } });
        }
        handleTimeExpired();
      }
    }, 1000);
  }

  function handleTimeExpired() {
    state.gameOver = true;
    stopClock();
    window.ChessSound.playGameOver();

    // Pieces lost ("cut"): Black captured White pieces = engine.captured.b.length, and vice versa
    const whiteCut = engine.captured.b.length;
    const blackCut = engine.captured.w.length;

    const whiteLabel =
      state.mode === 'pvp' && state.pvpType === 'online'
        ? state.onlineColor === 'w'
          ? getLocalPlayerName()
          : state.opponentName
        : 'White';
    const blackLabel =
      state.mode === 'pvp' && state.pvpType === 'online'
        ? state.onlineColor === 'b'
          ? getLocalPlayerName()
          : state.opponentName
        : 'Black';

    if (whiteCut < blackCut) {
      gameoverBadge.innerHTML = ICON_TROPHY;
      gameoverTitle.textContent = "Time's Up!";
      gameoverSubtitle.textContent = `${whiteLabel} wins! Lost fewer pieces (${whiteCut} vs ${blackCut}).`;
    } else if (blackCut < whiteCut) {
      gameoverBadge.innerHTML = ICON_TROPHY;
      gameoverTitle.textContent = "Time's Up!";
      gameoverSubtitle.textContent = `${blackLabel} wins! Lost fewer pieces (${blackCut} vs ${whiteCut}).`;
    } else {
      gameoverBadge.innerHTML = ICON_DRAW;
      gameoverTitle.textContent = "Time's Up — Draw!";
      gameoverSubtitle.textContent = `Both players lost ${whiteCut} ${whiteCut === 1 ? 'piece' : 'pieces'}.`;
    }

    gameoverModal.classList.remove('hidden');
    updatePlayerBars();
    updateStatusPanel();
  }

  function startNewGame(fromRemote = false) {
    if (state.aiTimer) {
      clearTimeout(state.aiTimer);
      state.aiTimer = null;
    }
    stopClock();
    engine.reset();
    state.clocks = { w: state.timeControl, b: state.timeControl };
    state.selected = null;
    state.legalForSelected = [];
    state.lastMove = null;
    state.slideMove = null;
    state.pendingPromotion = null;
    state.aiThinking = false;
    state.gameOver = false;
    drawOfferBanner.classList.add('hidden');
    if (state.mode === 'ai') {
      state.flipped = state.humanColor === 'b';
    } else if (state.mode === 'pvp' && state.pvpType === 'online') {
      state.flipped = state.onlineColor === 'b';
    } else {
      state.flipped = false;
    }

    if (!fromRemote && state.mode === 'pvp' && state.pvpType === 'online' && state.onlineConnected) {
      online.send({ type: 'new_game' });
    }

    promoModal.classList.add('hidden');
    gameoverModal.classList.add('hidden');
    renderAll();
    saveSession();
    maybeTriggerAI();
  }

  function maybeTriggerAI() {
    if (state.mode !== 'ai' || state.gameOver) return;
    if (engine.turn === state.humanColor) return;

    state.aiThinking = true;
    updatePlayerBars();
    updateStatusPanel();

    const delay = state.difficulty === 'hard' ? 280 : 220;
    state.aiTimer = setTimeout(() => {
      state.aiTimer = null;
      const bestMove = window.ChessAI.chooseBestMove(engine, state.difficulty);
      state.aiThinking = false;
      if (bestMove) {
        executeMove(bestMove);
      }
    }, delay);
  }

  function executeMove(move, fromRemote = false) {
    const entry = engine.makeMove(move);
    if (!entry) return;

    if (!fromRemote && state.mode === 'pvp' && state.pvpType === 'online' && state.onlineConnected) {
      online.send({ type: 'move', move, clocks: { ...state.clocks } });
    }

    state.selected = null;
    state.legalForSelected = [];
    state.slideMove = {
      fromR: move.fromR,
      fromC: move.fromC,
      toR: move.toR,
      toC: move.toC
    };
    state.lastMove = {
      fromR: move.fromR,
      fromC: move.fromC,
      toR: move.toR,
      toC: move.toC
    };

    const movedPiece = engine.board[move.toR][move.toC];
    const pieceType = movedPiece ? movedPiece.type : 'P';

    const status = engine.getGameStatus();
    if (status.state !== 'playing') {
      window.ChessSound.playGameOver();
    } else if (status.inCheck) {
      window.ChessSound.playCheck();
    } else if (move.castle) {
      window.ChessSound.playCastle();
    } else if (entry.captured) {
      window.ChessSound.playCapture(pieceType);
    } else {
      window.ChessSound.playMove(pieceType);
    }

    renderAll();
    saveSession();

    if (status.state !== 'playing') {
      stopClock();
      handleGameOver(status);
    } else {
      ensureClockRunning();
      maybeTriggerAI();
    }
  }

  const ICON_TROPHY = `<svg class="ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
  const ICON_BOT = `<svg class="ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`;
  const ICON_DRAW = `<svg class="ui-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
  const ICON_SOUND_ON = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const ICON_SOUND_OFF = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  const ICON_MIC_ON = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const ICON_MIC_OFF = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

  function getLocalPlayerName() {
    const raw = inputPlayerName ? inputPlayerName.value.trim() : '';
    return raw || 'Player';
  }

  function launchConfetti() {
    if (!confettiCanvas) return;
    const rect = confettiCanvas.getBoundingClientRect();
    confettiCanvas.width = rect.width || 560;
    confettiCanvas.height = rect.height || 560;
    const ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#38bdf8', '#a855f7', '#fb7185', '#34d399', '#fbbf24', '#f472b6'];
    const particles = Array.from({ length: 85 }, () => ({
      x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 120,
      y: confettiCanvas.height * 0.35 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.85) * 9 - 2,
      size: 5 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      life: 1
    }));

    function frame() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.rot += p.vRot;
        p.life -= 0.014;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      }
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    requestAnimationFrame(frame);
  }

  function showReactionToast(sender, text) {
    if (!reactionToast) return;
    if (state.reactionTimer) clearTimeout(state.reactionTimer);
    reactionToast.textContent = `${sender}: ${text}`;
    reactionToast.classList.remove('hidden');
    state.reactionTimer = setTimeout(() => {
      reactionToast.classList.add('hidden');
    }, 2400);
  }

  function saveSession() {
    try {
      const payload = {
        mode: state.mode,
        pvpType: state.pvpType,
        difficulty: state.difficulty,
        timeControl: state.timeControl,
        humanColor: state.humanColor,
        clocks: state.clocks,
        moves: engine.moveList.map((m) => m.move),
        onlineGameId: state.mode === 'pvp' && state.pvpType === 'online' ? online.gameId : null,
        onlineRole: state.mode === 'pvp' && state.pvpType === 'online' ? online.role : null,
        onlineColor: state.onlineColor,
        opponentName: state.opponentName
      };
      sessionStorage.setItem('chromachess_session', JSON.stringify(payload));
    } catch (_) {}
  }

  function handleGameOver(status) {
    state.gameOver = true;
    stopClock();
    if (status.state === 'checkmate') {
      let winnerName;
      if (state.mode === 'ai') {
        winnerName = status.winner === state.humanColor ? 'You Win!' : 'Computer Wins!';
      } else if (state.mode === 'pvp' && state.pvpType === 'online') {
        winnerName =
          status.winner === state.onlineColor
            ? `${getLocalPlayerName()} Wins!`
            : `${state.opponentName} Wins!`;
      } else {
        winnerName = status.winner === 'w' ? 'White Wins!' : 'Black Wins!';
      }
      gameoverBadge.innerHTML = status.winner === state.humanColor || state.mode === 'pvp' ? ICON_TROPHY : ICON_BOT;
      gameoverTitle.textContent = 'Checkmate!';
      gameoverSubtitle.textContent = `${winnerName} (${status.winner === 'w' ? 'White' : 'Black'} delivered mate)`;
      launchConfetti();
    } else if (status.state === 'resign') {
      gameoverBadge.innerHTML = ICON_TROPHY;
      gameoverTitle.textContent = 'Game Over';
      gameoverSubtitle.textContent = status.reason;
      launchConfetti();
    } else {
      gameoverBadge.innerHTML = ICON_DRAW;
      gameoverTitle.textContent = status.reason;
      const drawDetails = {
        Stalemate: `${engine.turn === 'w' ? 'White' : 'Black'} has no legal moves and is not in check.`,
        'Threefold repetition': 'The exact same position occurred three times.',
        'Insufficient material': 'Neither side has enough pieces to force checkmate.',
        '50-move rule': '50 moves played without a pawn move or capture.',
        'Draw by agreement': 'Both players agreed to a draw.'
      };
      gameoverSubtitle.textContent = drawDetails[status.reason] || 'The game ended in a draw.';
    }
    gameoverModal.classList.remove('hidden');
    updateStatusPanel();
  }

  function tryMoveTo(toR, toC) {
    const matching = state.legalForSelected.filter((m) => m.toR === toR && m.toC === toC);
    if (matching.length === 0) return false;

    const promoMoves = matching.filter((m) => m.promotion);
    if (promoMoves.length > 0) {
      state.pendingPromotion = {
        fromR: matching[0].fromR,
        fromC: matching[0].fromC,
        toR,
        toC,
        color: engine.turn
      };
      showPromotionModal(engine.turn);
      return true;
    }

    executeMove(matching[0]);
    return true;
  }

  function showPromotionModal(color) {
    promoOptions.innerHTML = '';
    ['Q', 'R', 'B', 'N'].forEach((type) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-btn';
      btn.setAttribute('aria-label', `Promote to ${type}`);
      btn.innerHTML = window.ChessPieces.getPieceSvg(color, type);
      btn.addEventListener('click', () => {
        const pending = state.pendingPromotion;
        state.pendingPromotion = null;
        promoModal.classList.add('hidden');
        if (pending) {
          executeMove({
            fromR: pending.fromR,
            fromC: pending.fromC,
            toR: pending.toR,
            toC: pending.toC,
            promotion: type
          });
        }
      });
      promoOptions.appendChild(btn);
    });
    promoModal.classList.remove('hidden');
  }

  function handleSquareClick(r, c) {
    if (!isHumanTurn()) return;

    // If a piece is selected and user clicks a legal destination
    if (state.selected) {
      if (state.selected.r === r && state.selected.c === c) {
        state.selected = null;
        state.legalForSelected = [];
        renderBoard();
        return;
      }
      if (tryMoveTo(r, c)) return;
    }

    const piece = engine.board[r][c];
    if (piece && piece.color === engine.turn) {
      state.selected = { r, c };
      state.legalForSelected = engine.getLegalMovesForSquare(r, c);
      renderBoard();
    } else {
      state.selected = null;
      state.legalForSelected = [];
      renderBoard();
    }
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const checkKing = engine.inCheck(engine.turn) ? engine.findKing(engine.turn) : null;
    const legalTargets = new Map();
    for (const m of state.legalForSelected) {
      legalTargets.set(`${m.toR},${m.toC}`, m);
    }

    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const r = state.flipped ? 7 - vr : vr;
        const c = state.flipped ? 7 - vc : vc;

        const sq = document.createElement('div');
        const isLight = (r + c) % 2 === 0;
        sq.className = `square ${isLight ? 'light' : 'dark'}`;
        sq.dataset.r = r;
        sq.dataset.c = c;
        sq.setAttribute('role', 'gridcell');

        if (state.lastMove) {
          if (state.lastMove.fromR === r && state.lastMove.fromC === c) sq.classList.add('last-from');
          if (state.lastMove.toR === r && state.lastMove.toC === c) sq.classList.add('last-to');
        }

        if (state.selected && state.selected.r === r && state.selected.c === c) {
          sq.classList.add('selected');
        }

        if (checkKing && checkKing.r === r && checkKing.c === c) {
          sq.classList.add('in-check');
        }

        // Coordinates on outer edges
        if (vc === 0) {
          const rankEl = document.createElement('span');
          rankEl.className = 'coord-rank';
          rankEl.textContent = RANKS[r];
          sq.appendChild(rankEl);
        }
        if (vr === 7) {
          const fileEl = document.createElement('span');
          fileEl.className = 'coord-file';
          fileEl.textContent = FILES[c];
          sq.appendChild(fileEl);
        }

        // Legal move hint
        const legalMove = legalTargets.get(`${r},${c}`);
        const piece = engine.board[r][c];
        if (legalMove) {
          const indicator = document.createElement('span');
          indicator.className = piece || legalMove.isEnPassant ? 'capture-ring' : 'move-dot';
          sq.appendChild(indicator);
        }

        // Piece
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece';
          pieceEl.innerHTML = window.ChessPieces.getPieceSvg(piece.color, piece.type);
          const canDrag = isHumanTurn() && piece.color === engine.turn;
          pieceEl.draggable = canDrag;

          if (state.slideMove && state.slideMove.toR === r && state.slideMove.toC === c) {
            const fromVR = state.flipped ? 7 - state.slideMove.fromR : state.slideMove.fromR;
            const fromVC = state.flipped ? 7 - state.slideMove.fromC : state.slideMove.fromC;
            const dxPct = (fromVC - vc) * 116;
            const dyPct = (fromVR - vr) * 116;
            if (dxPct !== 0 || dyPct !== 0) {
              pieceEl.style.transform = `translate(${dxPct}%, ${dyPct}%)`;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  pieceEl.classList.add('sliding');
                  pieceEl.style.transform = '';
                });
              });
            }
          }

          if (canDrag) {
            pieceEl.addEventListener('dragstart', (e) => {
              state.selected = { r, c };
              state.legalForSelected = engine.getLegalMovesForSquare(r, c);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', `${r},${c}`);
              setTimeout(() => renderBoard(), 0);
            });
          }
          sq.appendChild(pieceEl);
        }

        sq.addEventListener('click', () => handleSquareClick(r, c));
        sq.addEventListener('dragover', (e) => {
          if (legalTargets.has(`${r},${c}`)) {
            e.preventDefault();
            sq.classList.add('drag-over');
          }
        });
        sq.addEventListener('dragleave', () => sq.classList.remove('drag-over'));
        sq.addEventListener('drop', (e) => {
          e.preventDefault();
          sq.classList.remove('drag-over');
          if (!isHumanTurn()) return;
          tryMoveTo(r, c);
        });

        boardEl.appendChild(sq);
      }
    }
    state.slideMove = null;
  }

  function renderCapturedStrip(container, capturedPieces, advantage) {
    container.innerHTML = '';
    const sorted = [...capturedPieces].sort(
      (a, b) => PIECE_MAT_VAL[b.type] - PIECE_MAT_VAL[a.type]
    );
    for (const p of sorted) {
      const span = document.createElement('span');
      span.className = 'captured-piece-svg';
      span.innerHTML = window.ChessPieces.getPieceSvg(p.color, p.type);
      container.appendChild(span);
    }
    if (advantage > 0) {
      const adv = document.createElement('span');
      adv.className = 'material-adv';
      adv.textContent = `+${advantage}`;
      container.appendChild(adv);
    }
  }

  function updatePlayerBars() {
    const topColor = state.flipped ? 'w' : 'b';
    const bottomColor = state.flipped ? 'b' : 'w';

    const labelFor = (color) => {
      if (state.mode === 'pvp') {
        if (state.pvpType === 'online') {
          if (!state.onlineConnected) {
            return color === 'w' ? `${getLocalPlayerName()} (Host)` : 'Waiting for opponent...';
          }
          return color === state.onlineColor
            ? `${getLocalPlayerName()} (You)`
            : state.opponentName;
        }
        return color === 'w' ? 'Player 1' : 'Player 2';
      }
      if (color === state.humanColor) return 'You';
      const cap = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
      return `Computer (${cap})`;
    };

    topNameEl.textContent = labelFor(topColor);
    topMetaEl.textContent = topColor === 'w' ? 'White' : 'Black';
    topAvatarEl.textContent = topColor === 'w' ? '♔' : '♚';
    topAvatarEl.className = `player-avatar ${topColor === 'w' ? 'white-avatar' : 'black-avatar'}`;

    bottomNameEl.textContent = labelFor(bottomColor);
    bottomMetaEl.textContent = bottomColor === 'w' ? 'White' : 'Black';
    bottomAvatarEl.textContent = bottomColor === 'w' ? '♔' : '♚';
    bottomAvatarEl.className = `player-avatar ${bottomColor === 'w' ? 'white-avatar' : 'black-avatar'}`;

    const matW = engine.captured.w.reduce((s, p) => s + PIECE_MAT_VAL[p.type], 0);
    const matB = engine.captured.b.reduce((s, p) => s + PIECE_MAT_VAL[p.type], 0);

    const topAdv = topColor === 'w' ? matW - matB : matB - matW;
    const bottomAdv = bottomColor === 'w' ? matW - matB : matB - matW;

    renderCapturedStrip(topCapturedEl, engine.captured[topColor], topAdv);
    renderCapturedStrip(bottomCapturedEl, engine.captured[bottomColor], bottomAdv);

    const topActive = !state.gameOver && engine.turn === topColor;
    const bottomActive = !state.gameOver && engine.turn === bottomColor;

    topTurnPill.classList.toggle('active', topActive);
    bottomTurnPill.classList.toggle('active', bottomActive);

    topTurnPill.textContent =
      topActive && state.mode === 'ai' && topColor !== state.humanColor && state.aiThinking
        ? 'Thinking...'
        : topActive
        ? 'Active Turn'
        : 'Waiting';

    bottomTurnPill.textContent =
      bottomActive && state.mode === 'ai' && bottomColor !== state.humanColor && state.aiThinking
        ? 'Thinking...'
        : bottomActive
        ? state.mode === 'ai'
          ? 'Your Turn'
          : 'Active Turn'
        : 'Waiting';
  }

  function updateStatusPanel() {
    const status = engine.getGameStatus();
    const turnName = engine.turn === 'w' ? 'White' : 'Black';

    statusDot.classList.remove('check', 'over');

    if (status.state === 'checkmate') {
      statusDot.classList.add('over');
      statusTitle.textContent = 'Checkmate!';
      statusDetail.textContent = `${status.winner === 'w' ? 'White' : 'Black'} wins the match.`;
    } else if (status.state !== 'playing') {
      statusDot.classList.add('over');
      statusTitle.textContent = status.reason;
      statusDetail.textContent = 'Game drawn. Start a new game anytime!';
    } else if (state.aiThinking) {
      statusTitle.textContent = `Computer (${state.difficulty}) Thinking...`;
      statusDetail.textContent = `${turnName} is calculating the next move.`;
    } else if (status.inCheck) {
      statusDot.classList.add('check');
      statusTitle.textContent = `${turnName} is in Check!`;
      statusDetail.textContent = 'Protect your king — only check-escaping moves are highlighted.';
    } else {
      statusTitle.textContent = `${turnName} to Move`;
      statusDetail.textContent =
        engine.moveList.length === 0
          ? 'Click or drag any piece to begin.'
          : `Last move: ${engine.moveList[engine.moveList.length - 1].san}`;
    }

    const minMovesForUndo = state.mode === 'ai' && state.humanColor === 'b' ? 1 : 0;
    btnUndo.disabled =
      engine.moveList.length <= minMovesForUndo ||
      state.aiThinking ||
      state.mode === 'pvp';

    const aiSettingsLocked = state.mode === 'ai' && (engine.moveList.length > 0 || state.aiThinking);
    sideChoiceCard.classList.toggle('hidden', state.mode !== 'ai' || aiSettingsLocked);
    if (mobileQuery.matches && mobileOnlineTopSlot) {
      const showOnlineTop = state.mode === 'pvp' && state.pvpType === 'online' && !state.onlineConnected;
      const showSideTop = state.mode === 'ai' && !aiSettingsLocked;
      mobileOnlineTopSlot.classList.toggle('hidden', !showOnlineTop && !showSideTop);
    }
    document.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.disabled = aiSettingsLocked;
      btn.title = aiSettingsLocked
        ? 'Difficulty is locked once the game starts. Click New Game to change.'
        : '';
    });
    document.querySelectorAll('[data-side]').forEach((btn) => {
      btn.disabled = aiSettingsLocked;
      btn.title = aiSettingsLocked
        ? 'Side is locked once the game starts. Click New Game to change.'
        : '';
    });

    const timeLocked = engine.moveList.length > 0 || state.aiThinking;
    document.querySelectorAll('[data-time]').forEach((btn) => {
      btn.disabled = timeLocked;
      btn.title = timeLocked ? 'Timer is locked once the game starts.' : '';
    });
  }

  function renderMoveHistory() {
    const moves = engine.moveList;
    moveCountEl.textContent = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`;

    if (moves.length === 0) {
      moveListEl.innerHTML = '<div class="empty-history">No moves yet. Let’s play!</div>';
      return;
    }

    moveListEl.innerHTML = '';
    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';

      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${Math.floor(i / 2) + 1}.`;

      const wSan = document.createElement('span');
      wSan.className = `move-san ${i === moves.length - 1 ? 'latest' : ''}`;
      wSan.textContent = moves[i].san;

      const bSan = document.createElement('span');
      bSan.className = `move-san ${i + 1 === moves.length - 1 ? 'latest' : ''}`;
      bSan.textContent = moves[i + 1] ? moves[i + 1].san : '';

      row.appendChild(num);
      row.appendChild(wSan);
      row.appendChild(bSan);
      moveListEl.appendChild(row);
    }
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }

  function renderAll() {
    renderBoard();
    updatePlayerBars();
    updateClockUI();
    updateStatusPanel();
    renderMoveHistory();
  }

  function updateVoiceUI(micOn) {
    btnVoiceMic.classList.toggle('active', Boolean(micOn));
    btnVoiceMic.setAttribute('aria-pressed', String(Boolean(micOn)));
    voiceMicIcon.innerHTML = micOn ? ICON_MIC_ON : ICON_MIC_OFF;
    voiceMicLabel.textContent = micOn ? 'Mic On' : 'Mic Off';

    btnVoiceSpeaker.classList.toggle('active', state.speakerEnabled);
    btnVoiceSpeaker.setAttribute('aria-pressed', String(state.speakerEnabled));
    voiceSpeakerIcon.innerHTML = state.speakerEnabled ? ICON_SOUND_ON : ICON_SOUND_OFF;
    voiceSpeakerLabel.textContent = state.speakerEnabled ? 'Speaker On' : 'Muted';
  }

  function setOnlineUI(statusType, message, gameId) {
    connBadge.className = 'conn-badge';
    if (statusType === 'waiting') {
      connBadge.classList.add('waiting');
      connBadge.textContent = 'Waiting';
    } else if (statusType === 'connected') {
      connBadge.classList.add('connected');
      connBadge.textContent = 'Live';
    } else if (statusType === 'error') {
      connBadge.classList.add('error');
      connBadge.textContent = 'Error';
    } else {
      connBadge.textContent = 'Offline';
    }

    if (roomStatusDot) {
      roomStatusDot.className = 'room-status-dot';
      const isPvpOnline = state.mode === 'pvp' && state.pvpType === 'online';
      roomStatusDot.classList.toggle('hidden', !isPvpOnline);
      if (statusType === 'waiting') roomStatusDot.classList.add('waiting');
      else if (statusType === 'connected') roomStatusDot.classList.add('connected');
      else if (statusType === 'error') roomStatusDot.classList.add('error');
      else roomStatusDot.classList.add('offline');
    }

    voiceControlsEl.classList.toggle('hidden', statusType !== 'connected');
    if (reactionBar) reactionBar.classList.toggle('hidden', statusType !== 'connected');
    if (onlineMatchActions) onlineMatchActions.classList.toggle('hidden', statusType !== 'connected');
    if (statusType !== 'connected' && drawOfferBanner) drawOfferBanner.classList.add('hidden');
    syncMobileLayout();

    if (gameId) {
      displayGameId.textContent = gameId;
      onlineSetupView.classList.add('hidden');
      onlineActiveView.classList.remove('hidden');
    } else if (statusType === 'offline' || statusType === 'error') {
      onlineSetupView.classList.remove('hidden');
      onlineActiveView.classList.add('hidden');
    }
    if (message) onlineHint.textContent = message;
  }

  const online = new window.ChessOnline({
    onStatus(statusType, message, gameId) {
      setOnlineUI(statusType, message, gameId);
    },
    onConnected(role, gameId) {
      state.onlineConnected = true;
      state.onlineColor = role === 'host' ? 'w' : 'b';
      updateVoiceUI(false);
      online.send({
        type: 'hello',
        name: getLocalPlayerName(),
        timeControl: role === 'host' ? state.timeControl : undefined
      });
      setOnlineUI('connected', `Connected! You play as ${state.onlineColor === 'w' ? 'White' : 'Black'}.`, gameId);

      if (engine.moveList.length > 0) {
        online.send({
          type: 'sync_state',
          moves: engine.moveList.map((m) => m.move),
          clocks: { ...state.clocks },
          timeControl: state.timeControl
        });
        renderAll();
        ensureClockRunning();
      } else {
        startNewGame(true);
      }
      saveSession();
    },
    onDisconnected() {
      state.onlineConnected = false;
      state.opponentName = 'Opponent';
      updateVoiceUI(false);
      setOnlineUI('error', 'Opponent disconnected from the room.');
      updatePlayerBars();
      updateStatusPanel();
    },
    onError(msg) {
      state.onlineConnected = false;
      updateVoiceUI(false);
      setOnlineUI('error', msg);
      alert(msg);
    },
    onRemoteStream(stream) {
      if (remoteVoiceAudio) {
        remoteVoiceAudio.srcObject = stream || null;
        remoteVoiceAudio.muted = !state.speakerEnabled;
      }
    },
    onVoiceError(msg) {
      onlineHint.textContent = msg;
      updateVoiceUI(false);
    },
    onMessage(payload) {
      if (!payload || !payload.type) return;
      if (payload.type === 'hello') {
        const cleanName = String(payload.name || '').trim().slice(0, 20);
        state.opponentName = cleanName || 'Opponent';
        if (typeof payload.timeControl === 'number') {
          state.timeControl = payload.timeControl;
          state.clocks = { w: state.timeControl, b: state.timeControl };
          document.querySelectorAll('[data-time]').forEach((b) =>
            b.classList.toggle('active', Number(b.dataset.time) === state.timeControl)
          );
          updateClockUI();
        }
        updatePlayerBars();
      } else if (payload.type === 'move' && payload.move) {
        if (payload.clocks) {
          state.clocks = {
            w: Number(payload.clocks.w) || 0,
            b: Number(payload.clocks.b) || 0
          };
        }
        executeMove(payload.move, true);
      } else if (payload.type === 'timeout') {
        if (payload.clocks) {
          state.clocks = {
            w: Number(payload.clocks.w) || 0,
            b: Number(payload.clocks.b) || 0
          };
        }
        updateClockUI();
        if (!state.gameOver) handleTimeExpired();
      } else if (payload.type === 'reaction' && payload.text) {
        showReactionToast(state.opponentName, String(payload.text).slice(0, 32));
      } else if (payload.type === 'resign') {
        if (!state.gameOver) {
          window.ChessSound.playGameOver();
          handleGameOver({
            state: 'resign',
            reason: `${state.opponentName} resigned. ${getLocalPlayerName()} wins!`
          });
        }
      } else if (payload.type === 'draw_offer') {
        if (!state.gameOver && drawOfferBanner) {
          drawOfferBanner.classList.remove('hidden');
        }
      } else if (payload.type === 'draw_response') {
        if (payload.accepted && !state.gameOver) {
          window.ChessSound.playGameOver();
          handleGameOver({ state: 'draw', reason: 'Draw by agreement' });
        } else if (!payload.accepted) {
          onlineHint.textContent = `${state.opponentName} declined the draw offer.`;
        }
      } else if (payload.type === 'new_game') {
        startNewGame(true);
      } else if (payload.type === 'sync_state' && Array.isArray(payload.moves)) {
        if (payload.moves.length > engine.moveList.length) {
          engine.reset();
          for (const mv of payload.moves) {
            engine.makeMove(mv);
          }
          if (typeof payload.timeControl === 'number') {
            state.timeControl = payload.timeControl;
            document.querySelectorAll('[data-time]').forEach((b) =>
              b.classList.toggle('active', Number(b.dataset.time) === state.timeControl)
            );
          }
          if (payload.clocks) {
            state.clocks = {
              w: Number(payload.clocks.w) || 0,
              b: Number(payload.clocks.b) || 0
            };
          }
          const last = engine.moveList[engine.moveList.length - 1];
          state.lastMove = last
            ? { fromR: last.move.fromR, fromC: last.move.fromC, toR: last.move.toR, toC: last.move.toC }
            : null;
          state.gameOver = false;
          renderAll();
          saveSession();
          const st = engine.getGameStatus();
          if (st.state !== 'playing') handleGameOver(st);
          else ensureClockRunning();
        }
      }
    }
  });

  function setMobileDrawerOpen(open) {
    if (!mobileDrawer || !mobileDrawerBackdrop || !btnMobileMenu) return;
    mobileDrawer.classList.toggle('open', open);
    mobileDrawerBackdrop.classList.toggle('hidden', !open);
    btnMobileMenu.setAttribute('aria-expanded', String(open));
  }

  function syncMobileLayout() {
    if (!mobileDrawerBody || !controlsBar || !actionsCard || !sidePanel) return;
    const isMobile = mobileQuery.matches;
    const isPvpOnline = state.mode === 'pvp' && state.pvpType === 'online';

    if (isMobile) {
      // Move items 1-7 into the right sidebar drawer
      [
        modeGroupEl,
        pvpTypeGroup,
        difficultyGroup,
        timeGroupEl,
        themeGroupEl,
        btnNewGameEl,
        btnFlipEl,
        btnSound
      ].forEach((el) => {
        if (el && el.parentElement !== mobileDrawerBody) {
          mobileDrawerBody.appendChild(el);
        }
      });

      // Undo button -> inside bottom player bar near timer (only for AI mode)
      if (state.mode === 'ai') {
        if (bottomPlayerBar && btnUndo && btnUndo.parentElement !== bottomPlayerBar) {
          bottomPlayerBar.insertBefore(btnUndo, bottomClockEl || null);
        }
      } else if (btnUndo && btnUndo.parentElement !== actionsCard) {
        actionsCard.appendChild(btnUndo);
      }
      actionsCard.classList.add('hidden');

      // Top of page slot: Online Room (before joining) OR Play As White/Black (in AI mode before game starts)
      if (isPvpOnline && !state.onlineConnected) {
        if (mobileOnlineTopSlot && onlineCard.parentElement !== mobileOnlineTopSlot) {
          mobileOnlineTopSlot.appendChild(onlineCard);
        }
        if (sideChoiceCard.parentElement !== sidePanel) {
          sidePanel.insertBefore(sideChoiceCard, historyCard || null);
        }
        mobileOnlineTopSlot?.classList.remove('hidden');
      } else if (state.mode === 'ai' && !sideChoiceCard.classList.contains('hidden')) {
        if (mobileOnlineTopSlot && sideChoiceCard.parentElement !== mobileOnlineTopSlot) {
          mobileOnlineTopSlot.appendChild(sideChoiceCard);
        }
        if (onlineCard.parentElement !== mobileDrawerBody) {
          mobileDrawerBody.appendChild(onlineCard);
        }
        mobileOnlineTopSlot?.classList.remove('hidden');
      } else {
        mobileOnlineTopSlot?.classList.add('hidden');
        if (onlineCard.parentElement !== mobileDrawerBody) {
          mobileDrawerBody.appendChild(onlineCard);
        }
        if (sideChoiceCard.parentElement !== sidePanel) {
          sidePanel.insertBefore(sideChoiceCard, historyCard || null);
        }
      }

      // Room status dot in top bar (only in 2P online mode)
      if (roomStatusDot) {
        roomStatusDot.classList.toggle('hidden', !isPvpOnline);
      }

      // Quick Reaction Pills -> top of board when connected in online mode
      if (isPvpOnline && state.onlineConnected) {
        if (mobileReactionTopSlot && reactionBar && reactionBar.parentElement !== mobileReactionTopSlot) {
          mobileReactionTopSlot.appendChild(reactionBar);
        }
        mobileReactionTopSlot?.classList.remove('hidden');
      } else {
        mobileReactionTopSlot?.classList.add('hidden');
        if (onlineActiveViewEl && reactionBar && reactionBar.parentElement !== onlineActiveViewEl) {
          onlineActiveViewEl.insertBefore(reactionBar, drawOfferBanner || null);
        }
      }
    } else {
      setMobileDrawerOpen(false);
      mobileOnlineTopSlot?.classList.add('hidden');
      mobileReactionTopSlot?.classList.add('hidden');
      roomStatusDot?.classList.add('hidden');

      [modeGroupEl, pvpTypeGroup, difficultyGroup, timeGroupEl, themeGroupEl].forEach((el) => {
        if (el && el.parentElement !== controlsBar) {
          controlsBar.appendChild(el);
        }
      });

      if (btnNewGameEl && btnNewGameEl.parentElement !== actionsCard) {
        actionsCard.insertBefore(btnNewGameEl, null);
      }
      if (btnUndo && btnUndo.parentElement !== actionsCard) {
        actionsCard.insertBefore(btnUndo, null);
      }
      if (btnFlipEl && btnFlipEl.parentElement !== actionsCard) {
        actionsCard.insertBefore(btnFlipEl, null);
      }
      if (btnSound && btnSound.parentElement !== actionsCard) {
        actionsCard.appendChild(btnSound);
      }
      actionsCard.classList.remove('hidden');

      if (sideChoiceCard.parentElement !== sidePanel) {
        sidePanel.insertBefore(sideChoiceCard, historyCard || null);
      }
      if (onlineCard.parentElement !== sidePanel) {
        sidePanel.insertBefore(onlineCard, historyCard || null);
      }
      if (onlineActiveViewEl && reactionBar && reactionBar.parentElement !== onlineActiveViewEl) {
        onlineActiveViewEl.insertBefore(reactionBar, drawOfferBanner || null);
      }
    }
  }

  function updateVisibility() {
    const isAI = state.mode === 'ai';
    const isPvpOnline = state.mode === 'pvp' && state.pvpType === 'online';
    difficultyGroup.classList.toggle('hidden', !isAI);
    sideChoiceCard.classList.toggle('hidden', !isAI);
    pvpTypeGroup.classList.toggle('hidden', isAI);
    onlineCard.classList.toggle('hidden', !isPvpOnline);
    btnUndo.classList.toggle('hidden', !isAI);

    document.querySelectorAll('[data-time-mode]').forEach((btn) => {
      btn.classList.toggle('hidden', btn.dataset.timeMode !== state.mode);
    });
    if ((isAI && state.timeControl === 900) || (!isAI && state.timeControl === 180)) {
      state.timeControl = 600;
      state.clocks = { w: 600, b: 600 };
      document.querySelectorAll('[data-time]').forEach((b) =>
        b.classList.toggle('active', Number(b.dataset.time) === 600)
      );
    }
    syncMobileLayout();
  }

  // Event Bindings
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (state.mode === mode) return;
      state.mode = mode;
      document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      if (mode === 'ai' && (state.onlineConnected || online.gameId)) {
        online.leave();
        state.onlineConnected = false;
      }
      updateVisibility();
      startNewGame();
    });
  });

  document.querySelectorAll('[data-pvp-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pvpType = btn.dataset.pvpType;
      if (state.pvpType === pvpType) return;
      state.pvpType = pvpType;
      document.querySelectorAll('[data-pvp-type]').forEach((b) => b.classList.toggle('active', b === btn));
      if (pvpType === 'offline') {
        online.leave();
        state.onlineConnected = false;
        setOnlineUI('offline', 'Share this Game ID with your friend.');
      }
      updateVisibility();
      startNewGame();
    });
  });

  document.getElementById('btn-host-game').addEventListener('click', () => {
    online.hostGame();
  });

  document.getElementById('btn-join-game').addEventListener('click', () => {
    online.joinGame(inputGameId.value);
  });

  inputGameId.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') online.joinGame(inputGameId.value);
  });

  document.getElementById('btn-leave-room').addEventListener('click', () => {
    online.leave();
    state.onlineConnected = false;
    setOnlineUI('offline', 'Left the room.');
    startNewGame(true);
  });

  document.getElementById('btn-copy-id').addEventListener('click', () => {
    if (!online.gameId) return;
    navigator.clipboard?.writeText(online.gameId);
    onlineHint.textContent = `Copied Game ID: ${online.gameId}`;
  });

  btnVoiceMic.addEventListener('click', async () => {
    const micOn = await online.toggleMic();
    updateVoiceUI(micOn);
  });

  btnVoiceSpeaker.addEventListener('click', () => {
    state.speakerEnabled = !state.speakerEnabled;
    if (remoteVoiceAudio) {
      remoteVoiceAudio.muted = !state.speakerEnabled;
    }
    updateVoiceUI(online.micEnabled);
  });

  document.querySelectorAll('[data-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (engine.moveList.length > 0 || state.aiThinking) return;
      state.difficulty = btn.dataset.diff;
      document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('active', b === btn));
      updatePlayerBars();
    });
  });

  document.querySelectorAll('[data-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (engine.moveList.length > 0 || state.aiThinking) return;
      const side = btn.dataset.side;
      if (state.humanColor === side) return;
      state.humanColor = side;
      document.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('active', b === btn));
      startNewGame();
    });
  });

  document.querySelectorAll('.swatch[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.body.dataset.theme = btn.dataset.theme;
      document.querySelectorAll('.swatch[data-theme]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  function handleNewGameClick() {
    if (state.mode === 'ai') {
      state.humanColor = 'w';
      document.querySelectorAll('[data-side]').forEach((b) =>
        b.classList.toggle('active', b.dataset.side === 'w')
      );
    }
    if (mobileQuery.matches) setMobileDrawerOpen(false);
    startNewGame(false);
  }

  btnMobileMenu?.addEventListener('click', () => {
    const isOpen = mobileDrawer?.classList.contains('open');
    setMobileDrawerOpen(!isOpen);
  });
  btnMobileClose?.addEventListener('click', () => setMobileDrawerOpen(false));
  mobileDrawerBackdrop?.addEventListener('click', () => setMobileDrawerOpen(false));
  mobileQuery.addEventListener?.('change', syncMobileLayout);

  document.getElementById('btn-new-game').addEventListener('click', handleNewGameClick);
  document.getElementById('btn-play-again').addEventListener('click', handleNewGameClick);
  document.getElementById('btn-review-board').addEventListener('click', () => {
    gameoverModal.classList.add('hidden');
  });

  document.getElementById('btn-flip').addEventListener('click', () => {
    state.flipped = !state.flipped;
    renderBoard();
    updatePlayerBars();
    updateClockUI();
  });

  btnUndo.addEventListener('click', () => {
    const minMovesForUndo = state.mode === 'ai' && state.humanColor === 'b' ? 1 : 0;
    if (state.aiThinking || engine.moveList.length <= minMovesForUndo) return;
    if (state.mode === 'pvp') return;
    // Undo both AI response and player move when possible
    if (engine.turn === state.humanColor && engine.moveList.length >= minMovesForUndo + 2) {
      engine.undoMove();
      engine.undoMove();
    } else {
      engine.undoMove();
    }
    state.gameOver = false;
    state.selected = null;
    state.legalForSelected = [];
    const last = engine.moveList[engine.moveList.length - 1];
    state.lastMove = last
      ? { fromR: last.move.fromR, fromC: last.move.fromC, toR: last.move.toR, toC: last.move.toC }
      : null;
    gameoverModal.classList.add('hidden');
    renderAll();
    saveSession();
  });

  btnSound.addEventListener('click', () => {
    const next = !window.ChessSound.isEnabled();
    window.ChessSound.setEnabled(next);
    btnSound.setAttribute('aria-pressed', String(next));
    soundIcon.innerHTML = next ? ICON_SOUND_ON : ICON_SOUND_OFF;
    soundLabel.textContent = next ? 'Sound On' : 'Muted';
  });

  document.querySelectorAll('[data-time]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (engine.moveList.length > 0 || state.aiThinking) return;
      state.timeControl = Number(btn.dataset.time);
      state.clocks = { w: state.timeControl, b: state.timeControl };
      document.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('active', b === btn));
      updateClockUI();
      saveSession();
    });
  });

  document.querySelectorAll('.react-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.onlineConnected) return;
      const text = btn.dataset.react;
      online.send({ type: 'reaction', text });
      showReactionToast(getLocalPlayerName(), text);
    });
  });

  document.getElementById('btn-offer-draw')?.addEventListener('click', () => {
    if (!state.onlineConnected || state.gameOver) return;
    online.send({ type: 'draw_offer' });
    onlineHint.textContent = 'Draw offer sent to opponent...';
  });

  document.getElementById('btn-resign')?.addEventListener('click', () => {
    if (!state.onlineConnected || state.gameOver) return;
    online.send({ type: 'resign' });
    window.ChessSound.playGameOver();
    handleGameOver({
      state: 'resign',
      reason: `${getLocalPlayerName()} resigned. ${state.opponentName} wins!`
    });
  });

  document.getElementById('btn-accept-draw')?.addEventListener('click', () => {
    if (drawOfferBanner) drawOfferBanner.classList.add('hidden');
    if (!state.onlineConnected || state.gameOver) return;
    online.send({ type: 'draw_response', accepted: true });
    window.ChessSound.playGameOver();
    handleGameOver({ state: 'draw', reason: 'Draw by agreement' });
  });

  document.getElementById('btn-decline-draw')?.addEventListener('click', () => {
    if (drawOfferBanner) drawOfferBanner.classList.add('hidden');
    if (state.onlineConnected) online.send({ type: 'draw_response', accepted: false });
  });

  // Restore saved player name
  try {
    const savedName = localStorage.getItem('chromachess_name');
    if (savedName && inputPlayerName) inputPlayerName.value = savedName;
  } catch (_) {}

  if (inputPlayerName) {
    inputPlayerName.addEventListener('input', () => {
      try {
        localStorage.setItem('chromachess_name', inputPlayerName.value);
      } catch (_) {}
      updatePlayerBars();
    });
  }

  // Check URL ?game=ID for direct invite links
  const urlParams = new URLSearchParams(window.location.search);
  const invitedGameId = urlParams.get('game');
  let restored = false;

  if (invitedGameId) {
    state.mode = 'pvp';
    state.pvpType = 'online';
    document.getElementById('btn-mode-ai').classList.remove('active');
    document.getElementById('btn-mode-pvp').classList.add('active');
    document.getElementById('btn-pvp-offline').classList.remove('active');
    document.getElementById('btn-pvp-online').classList.add('active');
    inputGameId.value = invitedGameId.toUpperCase();
  }

  // Attempt session state recovery for AI, Offline, and Online games
  let pendingOnlineReconnect = null;
  if (!invitedGameId) {
    try {
      const raw = sessionStorage.getItem('chromachess_session');
      if (raw) {
        const saved = JSON.parse(raw);
        const hasMoves = saved && Array.isArray(saved.moves) && saved.moves.length > 0;
        const hasOnlineRoom = saved && saved.pvpType === 'online' && saved.onlineGameId && saved.onlineRole;
        if (hasMoves || hasOnlineRoom) {
          state.mode = saved.mode || 'ai';
          state.pvpType = saved.pvpType || 'offline';
          state.difficulty = saved.difficulty || 'medium';
          state.timeControl = typeof saved.timeControl === 'number' ? saved.timeControl : INITIAL_CLOCK_SECONDS;
          state.humanColor = saved.humanColor || 'w';
          state.onlineColor = saved.onlineColor || (saved.onlineRole === 'guest' ? 'b' : 'w');
          state.opponentName = saved.opponentName || 'Opponent';
          state.flipped =
            state.mode === 'ai'
              ? state.humanColor === 'b'
              : state.pvpType === 'online'
              ? state.onlineColor === 'b'
              : false;

          document.querySelectorAll('[data-mode]').forEach((b) =>
            b.classList.toggle('active', b.dataset.mode === state.mode)
          );
          document.querySelectorAll('[data-pvp-type]').forEach((b) =>
            b.classList.toggle('active', b.dataset.pvpType === state.pvpType)
          );
          document.querySelectorAll('[data-diff]').forEach((b) =>
            b.classList.toggle('active', b.dataset.diff === state.difficulty)
          );
          document.querySelectorAll('[data-time]').forEach((b) =>
            b.classList.toggle('active', Number(b.dataset.time) === state.timeControl)
          );
          document.querySelectorAll('[data-side]').forEach((b) =>
            b.classList.toggle('active', b.dataset.side === state.humanColor)
          );

          engine.reset();
          if (hasMoves) {
            for (const mv of saved.moves) {
              engine.makeMove(mv);
            }
          }
          if (saved.clocks) {
            state.clocks = {
              w: Number(saved.clocks.w) || 0,
              b: Number(saved.clocks.b) || 0
            };
          } else {
            state.clocks = { w: state.timeControl, b: state.timeControl };
          }
          const last = engine.moveList[engine.moveList.length - 1];
          state.lastMove = last
            ? { fromR: last.move.fromR, fromC: last.move.fromC, toR: last.move.toR, toC: last.move.toC }
            : null;
          if (hasOnlineRoom) {
            pendingOnlineReconnect = { id: saved.onlineGameId, role: saved.onlineRole };
          }
          restored = true;
        }
      }
    } catch (_) {}
  }

  updateVisibility();
  if (restored) {
    renderAll();
    const st = engine.getGameStatus();
    if (st.state !== 'playing') {
      handleGameOver(st);
    } else if (pendingOnlineReconnect) {
      if (pendingOnlineReconnect.role === 'host') {
        online.hostGame(pendingOnlineReconnect.id);
      } else {
        online.joinGame(pendingOnlineReconnect.id);
      }
    } else {
      ensureClockRunning();
      maybeTriggerAI();
    }
  } else {
    startNewGame();
  }
})();
