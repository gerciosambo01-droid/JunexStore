export type Player = 'white' | 'black';

export type RuleVariant = 'brazilian' | 'american';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameMode = 'ai' | 'local';

export type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface Piece {
  player: Player;
  isKing: boolean;
}

export type BoardState = (Piece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  /** Full sequence of landing squares for each step (length 1 for normal move or single jump, >1 for multi-jump) */
  path: Position[];
  /** Opponent pieces captured along the sequence */
  captures: Position[];
  /** Whether the moving piece becomes a King at the end of this move */
  promotes: boolean;
}

export interface MoveLogEntry {
  moveNumber: number;
  player: Player;
  notation: string;
  captureCount: number;
  promoted: boolean;
}

export interface GameEndResult {
  winner: Player | 'draw';
  reason: 'no_pieces' | 'no_moves' | 'twenty_moves' | 'repetition';
}

export interface GameSnapshot {
  board: BoardState;
  turn: Player;
  capturedByWhite: number;
  capturedByBlack: number;
  quietPlies: number;
  positionCounts: Record<string, number>;
  moveLog: MoveLogEntry[];
  lastMove: Move | null;
  kingsPromotedWhite: number;
  kingsPromotedBlack: number;
}
