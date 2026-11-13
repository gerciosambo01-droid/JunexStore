import { applyMove, BOARD_SIZE, getLegalMoves } from './rules';
import { BoardState, Difficulty, Move, Player, RuleVariant } from './types';

function evaluateBoard(board: BoardState, perspective: Player, variant: RuleVariant): number {
  let score = 0;
  const kingValue = variant === 'brazilian' ? 340 : 260;
  const manValue = 100;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (!p) continue;

      const sign = p.player === perspective ? 1 : -1;
      let pieceScore = p.isKing ? kingValue : manValue;

      // Center control bonus (columns 2..5, rows 2..5)
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
        pieceScore += p.isKing ? 18 : 14;
      }

      // Edge penalty for non-kings (less mobility), slight safety for back rank defense
      if (!p.isKing) {
        if (c === 0 || c === BOARD_SIZE - 1) {
          pieceScore -= 6;
        }
        const advancement = p.player === 'white' ? BOARD_SIZE - 1 - r : r;
        pieceScore += advancement * 5;

        // Back-rank guard bonus
        if ((p.player === 'white' && r === BOARD_SIZE - 1) || (p.player === 'black' && r === 0)) {
          pieceScore += 14;
        }
      } else {
        // Long diagonal control in Brazilian checkers
        if (variant === 'brazilian' && (r === c || r + c === BOARD_SIZE - 1)) {
          pieceScore += 12;
        }
      }

      score += sign * pieceScore;
    }
  }

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const capDiff = b.captures.length - a.captures.length;
    if (capDiff !== 0) return capDiff;
    if (a.promotes !== b.promotes) return a.promotes ? -1 : 1;
    // Slight preference for central destinations
    const aCenter = Math.abs(3.5 - a.to.row) + Math.abs(3.5 - a.to.col);
    const bCenter = Math.abs(3.5 - b.to.row) + Math.abs(3.5 - b.to.col);
    return aCenter - bCenter;
  });
}

function alphaBeta(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  currentTurn: Player,
  rootPlayer: Player,
  variant: RuleVariant,
): number {
  const legal = getLegalMoves(board, currentTurn, variant);

  if (legal.length === 0) {
    // Side to move has no legal moves -> loses
    return currentTurn === rootPlayer ? -100000 - depth * 10 : 100000 + depth * 10;
  }

  if (depth === 0) {
    return evaluateBoard(board, rootPlayer, variant) + (maximizingPlayer ? legal.length * 2 : -legal.length * 2);
  }

  const ordered = orderMoves(legal);
  const nextTurn: Player = currentTurn === 'white' ? 'black' : 'white';

  if (maximizingPlayer) {
    let value = -Infinity;
    for (const move of ordered) {
      const nextBoard = applyMove(board, move);
      const childVal = alphaBeta(nextBoard, depth - 1, alpha, beta, false, nextTurn, rootPlayer, variant);
      if (childVal > value) value = childVal;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const move of ordered) {
      const nextBoard = applyMove(board, move);
      const childVal = alphaBeta(nextBoard, depth - 1, alpha, beta, true, nextTurn, rootPlayer, variant);
      if (childVal < value) value = childVal;
      if (value < beta) beta = value;
      if (alpha >= beta) break;
    }
    return value;
  }
}

export function chooseAIMove(
  board: BoardState,
  aiPlayer: Player,
  variant: RuleVariant,
  difficulty: Difficulty,
): Move | null {
  const legal = getLegalMoves(board, aiPlayer, variant);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;
  const ordered = orderMoves(legal);
  const nextTurn: Player = aiPlayer === 'white' ? 'black' : 'white';

  const scored: { move: Move; score: number }[] = [];
  let bestScore = -Infinity;

  for (const move of ordered) {
    const nextBoard = applyMove(board, move);
    const score = alphaBeta(
      nextBoard,
      depth - 1,
      -Infinity,
      Infinity,
      false,
      nextTurn,
      aiPlayer,
      variant,
    );
    scored.push({ move, score });
    if (score > bestScore) {
      bestScore = score;
    }
  }

  if (difficulty === 'easy') {
    // Easy: pick randomly among moves within 85 points of best so it plays naturally without glaring blunders every turn
    const candidates = scored.filter((s) => s.score >= bestScore - 85);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.move;
  }

  const bestMoves = scored.filter((s) => s.score === bestScore);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
}

export function getBestHintMove(
  board: BoardState,
  player: Player,
  variant: RuleVariant,
): Move | null {
  return chooseAIMove(board, player, variant, 'medium');
}
