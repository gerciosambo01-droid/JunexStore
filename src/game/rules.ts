import { BoardState, GameEndResult, Move, Piece, Player, Position, RuleVariant } from './types';

export const BOARD_SIZE = 8;

const ALL_DIAGONALS: readonly [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function isInside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function isDarkSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

export function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function createInitialBoard(): BoardState {
  const board: BoardState = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isDarkSquare(r, c)) continue;
      if (r < 3) {
        board[r][c] = { player: 'black', isKing: false };
      } else if (r > 4) {
        board[r][c] = { player: 'white', isKing: false };
      }
    }
  }

  return board;
}

export function getForwardDir(player: Player): number {
  return player === 'white' ? -1 : 1;
}

export function isPromotionRow(row: number, player: Player): boolean {
  return player === 'white' ? row === 0 : row === BOARD_SIZE - 1;
}

export function posToAlgebraic(pos: Position): string {
  const file = String.fromCharCode(97 + pos.col); // a-h
  const rank = String(BOARD_SIZE - pos.row); // 8-1
  return `${file}${rank}`;
}

export function formatMoveNotation(move: Move): string {
  const sep = move.captures.length > 0 ? '×' : '–';
  const points = [move.from, ...move.path].map(posToAlgebraic);
  return points.join(sep);
}

export function serializeBoard(board: BoardState, turn: Player): string {
  let out = turn === 'white' ? 'w:' : 'b:';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isDarkSquare(r, c)) continue;
      const p = board[r][c];
      if (!p) {
        out += '.';
      } else if (p.player === 'white') {
        out += p.isKing ? 'W' : 'w';
      } else {
        out += p.isKing ? 'B' : 'b';
      }
    }
  }
  return out;
}

export function countPieces(board: BoardState): {
  whiteMen: number;
  whiteKings: number;
  blackMen: number;
  blackKings: number;
} {
  let whiteMen = 0;
  let whiteKings = 0;
  let blackMen = 0;
  let blackKings = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.player === 'white') {
        if (p.isKing) whiteKings++;
        else whiteMen++;
      } else {
        if (p.isKing) blackKings++;
        else blackMen++;
      }
    }
  }
  return { whiteMen, whiteKings, blackMen, blackKings };
}

function getCaptureDirectionsForMan(player: Player, variant: RuleVariant): readonly [number, number][] {
  if (variant === 'brazilian') {
    return ALL_DIAGONALS;
  }
  const f = getForwardDir(player);
  return [
    [f, -1],
    [f, 1],
  ];
}

function hasCaptured(captures: Position[], pos: Position): boolean {
  return captures.some((c) => c.row === pos.row && c.col === pos.col);
}

/**
 * Recursively finds all complete capture sequences from `pos` for `piece`.
 */
function findCaptureSequences(
  board: BoardState,
  origin: Position,
  current: Position,
  piece: Piece,
  variant: RuleVariant,
  pathSoFar: Position[],
  capturesSoFar: Position[],
  results: Move[],
): void {
  const dirs = piece.isKing ? ALL_DIAGONALS : getCaptureDirectionsForMan(piece.player, variant);
  let foundExtension = false;

  for (const [dr, dc] of dirs) {
    if (piece.isKing && variant === 'brazilian') {
      // Flying king capture: scan ray for first piece
      let r = current.row + dr;
      let c = current.col + dc;
      while (isInside(r, c) && board[r][c] === null) {
        r += dr;
        c += dc;
      }
      if (!isInside(r, c)) continue;
      const target = board[r][c];
      // Cannot jump over own piece or an already-captured piece in this chain
      if (!target || target.player === piece.player || hasCaptured(capturesSoFar, { row: r, col: c })) {
        continue;
      }
      const capturedPos: Position = { row: r, col: c };
      // All empty squares beyond capturedPos along same ray are candidate landings
      let lr = r + dr;
      let lc = c + dc;
      while (isInside(lr, lc) && board[lr][lc] === null) {
        foundExtension = true;
        const nextLanding: Position = { row: lr, col: lc };
        findCaptureSequences(
          board,
          origin,
          nextLanding,
          piece,
          variant,
          [...pathSoFar, nextLanding],
          [...capturesSoFar, capturedPos],
          results,
        );
        lr += dr;
        lc += dc;
      }
    } else {
      // Single-step capture (Brazilian man, American man, or American king)
      const mr = current.row + dr;
      const mc = current.col + dc;
      const lr = current.row + dr * 2;
      const lc = current.col + dc * 2;
      if (!isInside(lr, lc)) continue;
      const mid = board[mr][mc];
      const land = board[lr][lc];
      if (
        mid &&
        mid.player !== piece.player &&
        !hasCaptured(capturesSoFar, { row: mr, col: mc }) &&
        land === null
      ) {
        foundExtension = true;
        const nextLanding: Position = { row: lr, col: lc };
        const nextCaptures = [...capturesSoFar, { row: mr, col: mc }];

        // In American checkers, reaching the back rank immediately promotes and stops the chain
        if (variant === 'american' && !piece.isKing && isPromotionRow(lr, piece.player)) {
          results.push({
            from: origin,
            to: nextLanding,
            path: [...pathSoFar, nextLanding],
            captures: nextCaptures,
            promotes: true,
          });
        } else {
          findCaptureSequences(
            board,
            origin,
            nextLanding,
            piece,
            variant,
            [...pathSoFar, nextLanding],
            nextCaptures,
            results,
          );
        }
      }
    }
  }

  if (!foundExtension && capturesSoFar.length > 0) {
    const finalPos = pathSoFar[pathSoFar.length - 1];
    const promotes = !piece.isKing && isPromotionRow(finalPos.row, piece.player);
    results.push({
      from: origin,
      to: finalPos,
      path: pathSoFar,
      captures: capturesSoFar,
      promotes,
    });
  }
}

function findQuietMoves(
  board: BoardState,
  pos: Position,
  piece: Piece,
  variant: RuleVariant,
): Move[] {
  const moves: Move[] = [];
  const f = getForwardDir(piece.player);
  const dirs: readonly [number, number][] = piece.isKing
    ? ALL_DIAGONALS
    : [
        [f, -1],
        [f, 1],
      ];

  for (const [dr, dc] of dirs) {
    if (piece.isKing && variant === 'brazilian') {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (isInside(r, c) && board[r][c] === null) {
        const to = { row: r, col: c };
        moves.push({
          from: pos,
          to,
          path: [to],
          captures: [],
          promotes: false,
        });
        r += dr;
        c += dc;
      }
    } else {
      const r = pos.row + dr;
      const c = pos.col + dc;
      if (isInside(r, c) && board[r][c] === null) {
        const to = { row: r, col: c };
        moves.push({
          from: pos,
          to,
          path: [to],
          captures: [],
          promotes: !piece.isKing && isPromotionRow(r, piece.player),
        });
      }
    }
  }

  return moves;
}

/**
 * Generates all legal moves for `player` under `variant`.
 * Enforces mandatory capture (and majority capture rule in Brazilian rules).
 */
export function getLegalMoves(board: BoardState, player: Player, variant: RuleVariant): Move[] {
  const captureMoves: Move[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.player !== player) continue;
      const pos = { row: r, col: c };
      // Temporarily vacate origin during recursive chain search so flying kings can cross origin if needed
      const tempBoard = cloneBoard(board);
      tempBoard[r][c] = null;
      findCaptureSequences(tempBoard, pos, pos, piece, variant, [], [], captureMoves);
    }
  }

  if (captureMoves.length > 0) {
    if (variant === 'brazilian') {
      const maxCap = captureMoves.reduce((max, m) => Math.max(max, m.captures.length), 0);
      return captureMoves.filter((m) => m.captures.length === maxCap);
    }
    return captureMoves;
  }

  const quietMoves: Move[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.player !== player) continue;
      quietMoves.push(...findQuietMoves(board, { row: r, col: c }, piece, variant));
    }
  }

  return quietMoves;
}

export function applyMove(board: BoardState, move: Move): BoardState {
  const next = cloneBoard(board);
  const moving = next[move.from.row][move.from.col];
  if (!moving) return next;

  next[move.from.row][move.from.col] = null;
  for (const cap of move.captures) {
    next[cap.row][cap.col] = null;
  }

  next[move.to.row][move.to.col] = {
    player: moving.player,
    isKing: moving.isKing || move.promotes,
  };

  return next;
}

export function checkGameEnd(
  board: BoardState,
  nextTurn: Player,
  variant: RuleVariant,
  quietPlies: number,
  positionCounts: Record<string, number>,
): GameEndResult | null {
  const counts = countPieces(board);
  const whiteTotal = counts.whiteMen + counts.whiteKings;
  const blackTotal = counts.blackMen + counts.blackKings;

  if (whiteTotal === 0) {
    return { winner: 'black', reason: 'no_pieces' };
  }
  if (blackTotal === 0) {
    return { winner: 'white', reason: 'no_pieces' };
  }

  const legal = getLegalMoves(board, nextTurn, variant);
  if (legal.length === 0) {
    return {
      winner: nextTurn === 'white' ? 'black' : 'white',
      reason: 'no_moves',
    };
  }

  if (quietPlies >= 40) {
    return { winner: 'draw', reason: 'twenty_moves' };
  }

  const key = serializeBoard(board, nextTurn);
  if ((positionCounts[key] ?? 0) >= 3) {
    return { winner: 'draw', reason: 'repetition' };
  }

  return null;
}
