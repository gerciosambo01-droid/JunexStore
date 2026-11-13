import { BOARD_SIZE, isDarkSquare, posToAlgebraic, samePos } from '../game/rules';
import { BoardState, Move, Player, Position } from '../game/types';
import { CheckerPiece } from './CheckerPiece';

interface DamasBoardProps {
  board: BoardState;
  turn: Player;
  flipped?: boolean;
  selectedPos: Position | null;
  mustCapturePositions: Position[];
  validTargets: { pos: Position; isCapture: boolean }[];
  pendingCaptured: Position[];
  lastMove: Move | null;
  hintMove: Move | null;
  disabled?: boolean;
  onSquareClick: (pos: Position) => void;
}

const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function DamasBoard({
  board,
  turn,
  flipped = false,
  selectedPos,
  mustCapturePositions,
  validTargets,
  pendingCaptured,
  lastMove,
  hintMove,
  disabled = false,
  onSquareClick,
}: DamasBoardProps) {
  const rowIndices = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colIndices = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="relative select-none">
      {/* Outer beveled mahogany frame */}
      <div
        className="p-2.5 sm:p-3.5 rounded-xl bg-[#271A14] border border-[#4A3428]/80 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]"
        role="grid"
        aria-label="Tabuleiro de Damas 8 por 8"
      >
        {/* Top file coordinates */}
        <div className="grid grid-cols-8 px-4 sm:px-5 pb-1">
          {colIndices.map((c) => (
            <div
              key={`top-${c}`}
              className="text-center font-mono text-[10px] sm:text-[11px] font-medium text-[#A68E7A] tracking-wider"
            >
              {FILES[c]}
            </div>
          ))}
        </div>

        <div className="flex items-stretch">
          {/* Left rank coordinates */}
          <div className="flex flex-col justify-around pr-1.5 sm:pr-2">
            {rowIndices.map((r) => (
              <div
                key={`left-${r}`}
                className="font-mono text-[10px] sm:text-[11px] font-medium text-[#A68E7A] leading-none"
              >
                {RANKS[r]}
              </div>
            ))}
          </div>

          {/* 8x8 Playfield */}
          <div className="w-[min(86vw,64dvh,536px)] aspect-square grid grid-cols-8 grid-rows-8 rounded-[4px] overflow-hidden border border-[#140D0A] shadow-inner">
            {rowIndices.map((r) =>
              colIndices.map((c) => {
                const pos: Position = { row: r, col: c };
                const dark = isDarkSquare(r, c);
                const piece = board[r][c];
                const isSelected = selectedPos !== null && samePos(selectedPos, pos);
                const isMustCapture =
                  !disabled &&
                  piece?.player === turn &&
                  mustCapturePositions.some((p) => samePos(p, pos));
                const targetInfo = validTargets.find((t) => samePos(t.pos, pos));
                const isTarget = Boolean(targetInfo);
                const isPendingCaptured = pendingCaptured.some((p) => samePos(p, pos));
                const isLastMoveSquare =
                  lastMove !== null &&
                  (samePos(lastMove.from, pos) ||
                    samePos(lastMove.to, pos) ||
                    lastMove.path.some((p) => samePos(p, pos)));
                const isHintFrom = hintMove !== null && samePos(hintMove.from, pos);
                const isHintTo =
                  hintMove !== null &&
                  (samePos(hintMove.to, pos) || hintMove.path.some((p) => samePos(p, pos)));

                const coord = posToAlgebraic(pos);
                const pieceLabel = piece
                  ? `${piece.player === 'white' ? 'Peça clara' : 'Peça escura'}${piece.isKing ? ' (Dama)' : ''}`
                  : 'Casa vazia';

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={disabled || !dark}
                    onClick={() => dark && onSquareClick(pos)}
                    aria-label={`${coord}: ${pieceLabel}${isTarget ? ' — destino válido' : ''}`}
                    className={`relative flex items-center justify-center min-w-[36px] min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D99B26] transition-colors duration-150 ${
                      dark
                        ? 'bg-[#5A3B2B] hover:bg-[#644230]'
                        : 'bg-[#EADBC8] cursor-default'
                    }`}
                  >
                    {/* Last move subtle highlight */}
                    {dark && isLastMoveSquare && (
                      <span
                        className="absolute inset-0 bg-[#D99B26]/18 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {/* Selected square highlight */}
                    {dark && isSelected && (
                      <span
                        className="absolute inset-0 bg-[#D99B26]/28 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}

                    {/* Hint indicator */}
                    {(isHintFrom || isHintTo) && (
                      <span
                        className="absolute inset-1 rounded-sm border-2 border-dashed border-[#34D399] pointer-events-none z-20"
                        aria-hidden="true"
                      />
                    )}

                    {/* Piece */}
                    {piece && (
                      <CheckerPiece
                        piece={piece}
                        isSelected={isSelected}
                        isMustCapture={isMustCapture}
                        isPendingCaptured={isPendingCaptured}
                      />
                    )}

                    {/* Pending capture cross marker */}
                    {isPendingCaptured && (
                      <span
                        className="absolute z-20 text-[#F5EFE6] font-bold text-xs pointer-events-none"
                        aria-hidden="true"
                      >
                        ×
                      </span>
                    )}

                    {/* Valid target marker (quiet move vs capture) */}
                    {isTarget && targetInfo && (
                      <span
                        className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                        aria-hidden="true"
                      >
                        {targetInfo.isCapture ? (
                          <span className="w-[62%] h-[62%] rounded-full border-2 border-[#E3A93B] bg-[#C84B31]/30 flex items-center justify-center shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#E3A93B]" />
                          </span>
                        ) : (
                          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#D99B26]/90 ring-4 ring-[#D99B26]/20 shadow-sm" />
                        )}
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>

          {/* Right rank coordinates */}
          <div className="flex flex-col justify-around pl-1.5 sm:pl-2">
            {rowIndices.map((r) => (
              <div
                key={`right-${r}`}
                className="font-mono text-[10px] sm:text-[11px] font-medium text-[#A68E7A] leading-none"
              >
                {RANKS[r]}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom file coordinates */}
        <div className="grid grid-cols-8 px-4 sm:px-5 pt-1">
          {colIndices.map((c) => (
            <div
              key={`bottom-${c}`}
              className="text-center font-mono text-[10px] sm:text-[11px] font-medium text-[#A68E7A] tracking-wider"
            >
              {FILES[c]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
