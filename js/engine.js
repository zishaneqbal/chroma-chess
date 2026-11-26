/**
 * Complete Chess Rules Engine
 * Supports all standard rules: castling, en passant, promotion, check/checkmate,
 * stalemate, 50-move rule, insufficient material, threefold repetition, SAN, and undo.
 */
(function (global) {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const KNIGHT_DIRS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const KING_DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  function createInitialBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

    for (let c = 0; c < 8; c++) {
      board[0][c] = { color: 'b', type: backRank[c] };
      board[1][c] = { color: 'b', type: 'P' };
      board[6][c] = { color: 'w', type: 'P' };
      board[7][c] = { color: 'w', type: backRank[c] };
    }
    return board;
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function opponent(color) {
    return color === 'w' ? 'b' : 'w';
  }

  function squareName(r, c) {
    return FILES[c] + RANKS[r];
  }

  class ChessEngine {
    constructor() {
      this.reset();
    }

    reset() {
      this.board = createInitialBoard();
      this.turn = 'w';
      this.castling = { wK: true, wQ: true, bK: true, bQ: true };
      this.enPassant = null; // { r, c } or null
      this.halfmoveClock = 0;
      this.fullmoveNumber = 1;
      this.history = []; // stack of undo records
      this.moveList = []; // SAN & move metadata for UI
      this.captured = { w: [], b: [] }; // pieces captured BY 'w' and BY 'b'
      this.positionCounts = new Map();
      this._recordPosition();
    }

    _positionKey() {
      let key = '';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          key += p ? p.color + p.type : '.';
        }
      }
      const cast =
        (this.castling.wK ? 'K' : '') +
        (this.castling.wQ ? 'Q' : '') +
        (this.castling.bK ? 'k' : '') +
        (this.castling.bQ ? 'q' : '');
      const ep = this.enPassant ? `${this.enPassant.r}${this.enPassant.c}` : '-';
      return `${key}|${this.turn}|${cast}|${ep}`;
    }

    _recordPosition() {
      const key = this._positionKey();
      this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
      return key;
    }

    findKing(color) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (p && p.color === color && p.type === 'K') {
            return { r, c };
          }
        }
      }
      return null;
    }

    isSquareAttacked(r, c, byColor) {
      // Pawn attacks
      const pawnRow = byColor === 'w' ? r + 1 : r - 1;
      if (inBounds(pawnRow, c - 1)) {
        const p = this.board[pawnRow][c - 1];
        if (p && p.color === byColor && p.type === 'P') return true;
      }
      if (inBounds(pawnRow, c + 1)) {
        const p = this.board[pawnRow][c + 1];
        if (p && p.color === byColor && p.type === 'P') return true;
      }

      // Knight attacks
      for (const [dr, dc] of KNIGHT_DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p && p.color === byColor && p.type === 'N') return true;
        }
      }

      // Bishop / Queen diagonal attacks
      for (const [dr, dc] of BISHOP_DIRS) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p) {
            if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      // Rook / Queen orthogonal attacks
      for (const [dr, dc] of ROOK_DIRS) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p) {
            if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      // King attacks
      for (const [dr, dc] of KING_DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p && p.color === byColor && p.type === 'K') return true;
        }
      }

      return false;
    }

    inCheck(color = this.turn) {
      const king = this.findKing(color);
      if (!king) return false;
      return this.isSquareAttacked(king.r, king.c, opponent(color));
    }

    _pseudoLegalMovesFrom(r, c) {
      const piece = this.board[r][c];
      if (!piece) return [];
      const moves = [];
      const color = piece.color;
      const opp = opponent(color);

      if (piece.type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoRow = color === 'w' ? 0 : 7;

        const r1 = r + dir;
        if (inBounds(r1, c) && !this.board[r1][c]) {
          if (r1 === promoRow) {
            for (const promo of ['Q', 'R', 'B', 'N']) {
              moves.push({ fromR: r, fromC: c, toR: r1, toC: c, promotion: promo });
            }
          } else {
            moves.push({ fromR: r, fromC: c, toR: r1, toC: c });
            const r2 = r + dir * 2;
            if (r === startRow && !this.board[r2][c]) {
              moves.push({ fromR: r, fromC: c, toR: r2, toC: c, isDoublePush: true });
            }
          }
        }

        // Captures + En Passant
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!inBounds(r1, nc)) continue;
          const target = this.board[r1][nc];
          if (target && target.color === opp) {
            if (r1 === promoRow) {
              for (const promo of ['Q', 'R', 'B', 'N']) {
                moves.push({ fromR: r, fromC: c, toR: r1, toC: nc, promotion: promo, isCapture: true });
              }
            } else {
              moves.push({ fromR: r, fromC: c, toR: r1, toC: nc, isCapture: true });
            }
          } else if (this.enPassant && this.enPassant.r === r1 && this.enPassant.c === nc) {
            moves.push({ fromR: r, fromC: c, toR: r1, toC: nc, isEnPassant: true, isCapture: true });
          }
        }
      } else if (piece.type === 'N') {
        for (const [dr, dc] of KNIGHT_DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color === opp) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isCapture: Boolean(target) });
          }
        }
      } else if (piece.type === 'B' || piece.type === 'R' || piece.type === 'Q') {
        const dirs =
          piece.type === 'B'
            ? BISHOP_DIRS
            : piece.type === 'R'
            ? ROOK_DIRS
            : [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          while (inBounds(nr, nc)) {
            const target = this.board[nr][nc];
            if (!target) {
              moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
            } else {
              if (target.color === opp) {
                moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isCapture: true });
              }
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
      } else if (piece.type === 'K') {
        for (const [dr, dc] of KING_DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color === opp) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isCapture: Boolean(target) });
          }
        }

        // Castling
        const homeRow = color === 'w' ? 7 : 0;
        if (r === homeRow && c === 4 && !this.isSquareAttacked(homeRow, 4, opp)) {
          // Kingside
          const canK = color === 'w' ? this.castling.wK : this.castling.bK;
          if (
            canK &&
            !this.board[homeRow][5] &&
            !this.board[homeRow][6] &&
            this.board[homeRow][7] &&
            this.board[homeRow][7].color === color &&
            this.board[homeRow][7].type === 'R' &&
            !this.isSquareAttacked(homeRow, 5, opp) &&
            !this.isSquareAttacked(homeRow, 6, opp)
          ) {
            moves.push({ fromR: r, fromC: c, toR: homeRow, toC: 6, castle: 'K' });
          }

          // Queenside
          const canQ = color === 'w' ? this.castling.wQ : this.castling.bQ;
          if (
            canQ &&
            !this.board[homeRow][3] &&
            !this.board[homeRow][2] &&
            !this.board[homeRow][1] &&
            this.board[homeRow][0] &&
            this.board[homeRow][0].color === color &&
            this.board[homeRow][0].type === 'R' &&
            !this.isSquareAttacked(homeRow, 3, opp) &&
            !this.isSquareAttacked(homeRow, 2, opp)
          ) {
            moves.push({ fromR: r, fromC: c, toR: homeRow, toC: 2, castle: 'Q' });
          }
        }
      }

      return moves;
    }

    getLegalMoves(color = this.turn) {
      const legal = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p || p.color !== color) continue;
          const pseudo = this._pseudoLegalMovesFrom(r, c);
          for (const m of pseudo) {
            this._applyRawMove(m);
            const kingSafe = !this.inCheck(color);
            this._unapplyRawMove();
            if (kingSafe) legal.push(m);
          }
        }
      }
      return legal;
    }

    getLegalMovesForSquare(r, c) {
      const p = this.board[r][c];
      if (!p || p.color !== this.turn) return [];
      const pseudo = this._pseudoLegalMovesFrom(r, c);
      const legal = [];
      for (const m of pseudo) {
        this._applyRawMove(m);
        const kingSafe = !this.inCheck(p.color);
        this._unapplyRawMove();
        if (kingSafe) legal.push(m);
      }
      return legal;
    }

    _applyRawMove(move) {
      const movingPiece = this.board[move.fromR][move.fromC];
      let capturedPiece = this.board[move.toR][move.toC];
      let epCapturedPos = null;

      if (move.isEnPassant) {
        const capRow = movingPiece.color === 'w' ? move.toR + 1 : move.toR - 1;
        capturedPiece = this.board[capRow][move.toC];
        epCapturedPos = { r: capRow, c: move.toC };
        this.board[capRow][move.toC] = null;
      }

      const record = {
        move,
        movingPiece: { ...movingPiece },
        capturedPiece: capturedPiece ? { ...capturedPiece } : null,
        epCapturedPos,
        prevCastling: { ...this.castling },
        prevEnPassant: this.enPassant ? { ...this.enPassant } : null,
        prevHalfmove: this.halfmoveClock,
        prevFullmove: this.fullmoveNumber,
        prevTurn: this.turn,
        posKey: null
      };

      // Move piece
      this.board[move.fromR][move.fromC] = null;
      this.board[move.toR][move.toC] = move.promotion
        ? { color: movingPiece.color, type: move.promotion }
        : movingPiece;

      // Castling rook movement
      if (move.castle === 'K') {
        this.board[move.toR][5] = this.board[move.toR][7];
        this.board[move.toR][7] = null;
      } else if (move.castle === 'Q') {
        this.board[move.toR][3] = this.board[move.toR][0];
        this.board[move.toR][0] = null;
      }

      // Update castling rights
      if (movingPiece.type === 'K') {
        if (movingPiece.color === 'w') {
          this.castling.wK = false;
          this.castling.wQ = false;
        } else {
          this.castling.bK = false;
          this.castling.bQ = false;
        }
      }
      if (movingPiece.type === 'R') {
        if (move.fromR === 7 && move.fromC === 7) this.castling.wK = false;
        if (move.fromR === 7 && move.fromC === 0) this.castling.wQ = false;
        if (move.fromR === 0 && move.fromC === 7) this.castling.bK = false;
        if (move.fromR === 0 && move.fromC === 0) this.castling.bQ = false;
      }
      if (capturedPiece && capturedPiece.type === 'R') {
        if (move.toR === 7 && move.toC === 7) this.castling.wK = false;
        if (move.toR === 7 && move.toC === 0) this.castling.wQ = false;
        if (move.toR === 0 && move.toC === 7) this.castling.bK = false;
        if (move.toR === 0 && move.toC === 0) this.castling.bQ = false;
      }

      // En passant target
      if (move.isDoublePush) {
        this.enPassant = {
          r: (move.fromR + move.toR) / 2,
          c: move.fromC
        };
      } else {
        this.enPassant = null;
      }

      // Clocks & turn
      if (movingPiece.type === 'P' || capturedPiece) {
        this.halfmoveClock = 0;
      } else {
        this.halfmoveClock += 1;
      }
      if (this.turn === 'b') {
        this.fullmoveNumber += 1;
      }
      this.turn = opponent(this.turn);
      this.history.push(record);
      return record;
    }

    _unapplyRawMove() {
      const record = this.history.pop();
      if (!record) return null;
      const { move, movingPiece, capturedPiece, epCapturedPos } = record;

      this.turn = record.prevTurn;
      this.castling = record.prevCastling;
      this.enPassant = record.prevEnPassant;
      this.halfmoveClock = record.prevHalfmove;
      this.fullmoveNumber = record.prevFullmove;

      // Restore castling rook
      if (move.castle === 'K') {
        this.board[move.toR][7] = this.board[move.toR][5];
        this.board[move.toR][5] = null;
      } else if (move.castle === 'Q') {
        this.board[move.toR][0] = this.board[move.toR][3];
        this.board[move.toR][3] = null;
      }

      // Restore piece
      this.board[move.fromR][move.fromC] = movingPiece;
      this.board[move.toR][move.toC] = null;

      if (epCapturedPos) {
        this.board[epCapturedPos.r][epCapturedPos.c] = capturedPiece;
      } else if (capturedPiece) {
        this.board[move.toR][move.toC] = capturedPiece;
      }

      return record;
    }

    _computeSAN(move, allLegalMovesBefore) {
      if (move.castle === 'K') return 'O-O';
      if (move.castle === 'Q') return 'O-O-O';

      const piece = this.board[move.fromR][move.fromC];
      const target = this.board[move.toR][move.toC];
      const isCapture = Boolean(target) || Boolean(move.isEnPassant);
      let san = '';

      if (piece.type === 'P') {
        if (isCapture) {
          san += FILES[move.fromC] + 'x';
        }
        san += squareName(move.toR, move.toC);
        if (move.promotion) {
          san += '=' + move.promotion;
        }
      } else {
        san += piece.type;
        // Disambiguation
        const sameTypePeers = allLegalMovesBefore.filter(
          (m) =>
            (m.fromR !== move.fromR || m.fromC !== move.fromC) &&
            m.toR === move.toR &&
            m.toC === move.toC &&
            this.board[m.fromR][m.fromC]?.type === piece.type
        );
        if (sameTypePeers.length > 0) {
          const sameFile = sameTypePeers.some((m) => m.fromC === move.fromC);
          const sameRank = sameTypePeers.some((m) => m.fromR === move.fromR);
          if (!sameFile) {
            san += FILES[move.fromC];
          } else if (!sameRank) {
            san += RANKS[move.fromR];
          } else {
            san += squareName(move.fromR, move.fromC);
          }
        }
        if (isCapture) san += 'x';
        san += squareName(move.toR, move.toC);
      }
      return san;
    }

    makeMove(move) {
      const legalBefore = this.getLegalMoves(this.turn);
      const matched = legalBefore.find(
        (m) =>
          m.fromR === move.fromR &&
          m.fromC === move.fromC &&
          m.toR === move.toR &&
          m.toC === move.toC &&
          (m.promotion || null) === (move.promotion || null)
      );
      if (!matched) return null;

      let san = this._computeSAN(matched, legalBefore);
      const record = this._applyRawMove(matched);
      const posKey = this._recordPosition();
      record.posKey = posKey;

      if (record.capturedPiece) {
        this.captured[record.prevTurn].push(record.capturedPiece);
      }

      const status = this.getGameStatus();
      if (status.state === 'checkmate') {
        san += '#';
      } else if (status.inCheck) {
        san += '+';
      }

      const moveEntry = {
        san,
        color: record.prevTurn,
        move: matched,
        captured: record.capturedPiece,
        inCheck: status.inCheck
      };
      this.moveList.push(moveEntry);
      return moveEntry;
    }

    undoMove() {
      if (this.history.length === 0) return false;
      const lastRecord = this.history[this.history.length - 1];
      if (lastRecord.posKey) {
        const count = this.positionCounts.get(lastRecord.posKey) || 0;
        if (count <= 1) this.positionCounts.delete(lastRecord.posKey);
        else this.positionCounts.set(lastRecord.posKey, count - 1);
      }
      const record = this._unapplyRawMove();
      if (record.capturedPiece) {
        this.captured[record.prevTurn].pop();
      }
      this.moveList.pop();
      return true;
    }

    isInsufficientMaterial() {
      const pieces = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (p && p.type !== 'K') {
            pieces.push({ ...p, r, c });
          }
        }
      }
      if (pieces.length === 0) return true;
      if (pieces.length === 1 && (pieces[0].type === 'B' || pieces[0].type === 'N')) {
        return true;
      }
      if (
        pieces.length === 2 &&
        pieces[0].type === 'B' &&
        pieces[1].type === 'B' &&
        pieces[0].color !== pieces[1].color
      ) {
        const sqColor0 = (pieces[0].r + pieces[0].c) % 2;
        const sqColor1 = (pieces[1].r + pieces[1].c) % 2;
        if (sqColor0 === sqColor1) return true;
      }
      return false;
    }

    getGameStatus() {
      const inCheck = this.inCheck(this.turn);
      const legalMoves = this.getLegalMoves(this.turn);

      if (legalMoves.length === 0) {
        if (inCheck) {
          return {
            state: 'checkmate',
            winner: opponent(this.turn),
            inCheck: true,
            reason: 'Checkmate'
          };
        }
        return {
          state: 'stalemate',
          winner: null,
          inCheck: false,
          reason: 'Stalemate'
        };
      }

      if (this.halfmoveClock >= 100) {
        return {
          state: 'draw',
          winner: null,
          inCheck,
          reason: '50-move rule'
        };
      }

      if (this.isInsufficientMaterial()) {
        return {
          state: 'draw',
          winner: null,
          inCheck,
          reason: 'Insufficient material'
        };
      }

      const key = this._positionKey();
      if ((this.positionCounts.get(key) || 0) >= 3) {
        return {
          state: 'draw',
          winner: null,
          inCheck,
          reason: 'Threefold repetition'
        };
      }

      return {
        state: 'playing',
        winner: null,
        inCheck,
        reason: null
      };
    }
  }

  global.ChessEngine = ChessEngine;
})(typeof window !== 'undefined' ? window : globalThis);
