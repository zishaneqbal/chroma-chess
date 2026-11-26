/**
 * Chess Computer AI with 3 difficulty levels:
 * - easy:   Casual beginner (mostly random with light preference for captures/checks)
 * - medium: Depth 2 Alpha-Beta search with material + Piece-Square Tables
 * - hard:   Depth 3 Alpha-Beta search with MVV-LVA move ordering & full PST
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

  function alphaBeta(engine, depth, alpha, beta, maximizing, aiColor) {
    const turnColor = engine.turn;
    const moves = engine.getLegalMoves(turnColor);

    if (moves.length === 0) {
      if (engine.inCheck(turnColor)) {
        // Prefer faster checkmate
        return maximizing ? -100000 - depth : 100000 + depth;
      }
      return 0; // Stalemate
    }

    if (depth === 0) {
      return evaluateBoard(engine, aiColor);
    }

    orderMoves(engine, moves);

    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        engine._applyRawMove(m);
        const val = alphaBeta(engine, depth - 1, alpha, beta, false, aiColor);
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
        const val = alphaBeta(engine, depth - 1, alpha, beta, true, aiColor);
        engine._unapplyRawMove();
        if (val < best) best = val;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function chooseEasyMove(engine) {
    const moves = engine.getLegalMoves(engine.turn);
    if (moves.length === 0) return null;

    // 45% chance to prefer a capture or promotion if available, otherwise random
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

    const depth = difficulty === 'hard' ? 3 : 2;
    orderMoves(engine, moves);

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of moves) {
      engine._applyRawMove(m);
      const score = alphaBeta(engine, depth - 1, -Infinity, Infinity, false, aiColor);
      engine._unapplyRawMove();

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    }

    // Slight tie-breaker randomness among equally-scored best moves
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  global.ChessAI = { chooseBestMove, PIECE_VALUES };
})(typeof window !== 'undefined' ? window : globalThis);
