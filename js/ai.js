/**
 * Chess Computer AI with 3 difficulty levels, Opening Book, and Quiescence Search:
 * - easy:   Casual beginner (mostly random with light preference for captures/checks)
 * - medium: Opening book + Depth 2 Alpha-Beta search with material & Piece-Square Tables
 * - hard:   Opening book + Depth 3 Alpha-Beta search + Quiescence Search on captures
 */
(function (global) {
  const PIECE_VALUES = {
    P: 100,
    N: 320,
    B: 330,
    R: 500,
    Q: 900,
    K: 20000
  };

  // Curated Opening Book keyed by SAN move sequence (e.g. "e4 e5")
  // Each entry lists candidate SAN responses for variety.
  const OPENING_BOOK = {
    '': ['e4', 'd4', 'c4', 'Nf3'],
    'e4': ['e5', 'c5', 'e6', 'c6'],
    'd4': ['d5', 'Nf6', 'e6'],
    'c4': ['e5', 'Nf6', 'c5'],
    'Nf3': ['d5', 'Nf6', 'c5'],
    'e4 e5': ['Nf3', 'Bc4', 'Nc3'],
    'e4 e5 Nf3': ['Nc6', 'Nf6'],
    'e4 e5 Nf3 Nc6': ['Bb5', 'Bc4', 'd4'],
    'e4 c5': ['Nf3', 'Nc3', 'c3'],
    'e4 c5 Nf3': ['d6', 'Nc6', 'e6'],
    'e4 e6': ['d4'],
    'e4 e6 d4': ['d5'],
    'e4 c6': ['d4'],
    'e4 c6 d4': ['d5'],
    'd4 d5': ['c4', 'Nf3'],
    'd4 d5 c4': ['e6', 'c6', 'dxc4'],
    'd4 Nf6': ['c4', 'Nf3'],
    'd4 Nf6 c4': ['g6', 'e6', 'c5']
  };

  // Piece-Square Tables from White's perspective (row 0 = rank 8, row 7 = rank 1)
  const PST = {
    P: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 27, 27, 10,  5,  5],
      [0,  0,  0, 24, 24,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-22,-22, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    N: [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    B: [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    R: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ],
    Q: [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [-5,   0,  5,  5,  5,  5,  0, -5],
      [0,    0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    K: [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [20,  20,  0,  0,  0,  0, 20, 20],
      [20,  30, 10,  0,  0, 10, 30, 20]
    ]
  };

  function evaluateBoard(engine, aiColor) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        const pstRow = p.color === 'w' ? r : 7 - r;
        const val = PIECE_VALUES[p.type] + PST[p.type][pstRow][c];
        score += p.color === aiColor ? val : -val;
      }
    }
    return score;
  }

  function orderMoves(engine, moves) {
    return moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      const capA = engine.board[a.toR][a.toC];
      const capB = engine.board[b.toR][b.toC];
      const movA = engine.board[a.fromR][a.fromC];
      const movB = engine.board[b.fromR][b.fromC];

      if (capA && movA) scoreA += 10 * PIECE_VALUES[capA.type] - PIECE_VALUES[movA.type];
      if (capB && movB) scoreB += 10 * PIECE_VALUES[capB.type] - PIECE_VALUES[movB.type];
      if (a.promotion) scoreA += PIECE_VALUES[a.promotion];
      if (b.promotion) scoreB += PIECE_VALUES[b.promotion];
      if (a.castle) scoreA += 60;
      if (b.castle) scoreB += 60;

      return scoreB - scoreA;
    });
  }

  function quiescence(engine, alpha, beta, maximizing, aiColor, qDepth = 3) {
    const standPat = evaluateBoard(engine, aiColor);
    if (qDepth <= 0) return standPat;

    if (maximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      const captures = orderMoves(
        engine,
        engine.getLegalMoves(engine.turn).filter((m) => m.isCapture || m.promotion)
      );
      for (const m of captures) {
        engine._applyRawMove(m);
        const score = quiescence(engine, alpha, beta, false, aiColor, qDepth - 1);
        engine._unapplyRawMove();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;

      const captures = orderMoves(
        engine,
        engine.getLegalMoves(engine.turn).filter((m) => m.isCapture || m.promotion)
      );
      for (const m of captures) {
        engine._applyRawMove(m);
        const score = quiescence(engine, alpha, beta, true, aiColor, qDepth - 1);
        engine._unapplyRawMove();
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
      return beta;
    }
  }

  function alphaBeta(engine, depth, alpha, beta, maximizing, aiColor, useQuiescence) {
    const turnColor = engine.turn;
    const moves = engine.getLegalMoves(turnColor);

    if (moves.length === 0) {
      if (engine.inCheck(turnColor)) {
        return maximizing ? -100000 - depth : 100000 + depth;
      }
      return 0;
    }

    if (depth === 0) {
      return useQuiescence
        ? quiescence(engine, alpha, beta, maximizing, aiColor, 3)
        : evaluateBoard(engine, aiColor);
    }

    orderMoves(engine, moves);

    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        engine._applyRawMove(m);
        const val = alphaBeta(engine, depth - 1, alpha, beta, false, aiColor, useQuiescence);
        engine._unapplyRawMove();
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        engine._applyRawMove(m);
        const val = alphaBeta(engine, depth - 1, alpha, beta, true, aiColor, useQuiescence);
        engine._unapplyRawMove();
        if (val < best) best = val;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function pickOpeningBookMove(engine, legalMoves) {
    if (!engine.moveList || engine.moveList.length > 6) return null;
    const key = engine.moveList.map((m) => m.san.replace(/[+#]/g, '')).join(' ');
    const candidates = OPENING_BOOK[key];
    if (!candidates || candidates.length === 0) return null;

    // Match candidate SANs against actual legal moves
    const matched = [];
    for (const m of legalMoves) {
      const san = engine._computeSAN(m, legalMoves);
      if (candidates.includes(san)) matched.push(m);
    }
    if (matched.length === 0) return null;
    return matched[Math.floor(Math.random() * matched.length)];
  }

  function chooseEasyMove(engine) {
    const moves = engine.getLegalMoves(engine.turn);
    if (moves.length === 0) return null;

    const tactical = moves.filter((m) => m.isCapture || m.promotion);
    if (tactical.length > 0 && Math.random() < 0.45) {
      return tactical[Math.floor(Math.random() * tactical.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function chooseBestMove(engine, difficulty = 'medium') {
    const aiColor = engine.turn;
    const moves = engine.getLegalMoves(aiColor);
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      return chooseEasyMove(engine);
    }

    const bookMove = pickOpeningBookMove(engine, moves);
    if (bookMove) return bookMove;

    const isHard = difficulty === 'hard';
    const depth = isHard ? 3 : 2;
    orderMoves(engine, moves);

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of moves) {
      engine._applyRawMove(m);
      const score = alphaBeta(engine, depth - 1, -Infinity, Infinity, false, aiColor, isHard);
      engine._unapplyRawMove();

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  global.ChessAI = { chooseBestMove, PIECE_VALUES };
})(typeof window !== 'undefined' ? window : globalThis);
