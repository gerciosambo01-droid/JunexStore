import { GameEndResult, GameMode, GamePhase, Player } from '../game/types';

interface GameModalProps {
  phase: GamePhase;
  mode: GameMode;
  humanSide: Player;
  result: GameEndResult | null;
  totalMoves: number;
  capturedByWhite: number;
  capturedByBlack: number;
  kingsPromotedWhite: number;
  kingsPromotedBlack: number;
  onResume: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
}

export function GameModal({
  phase,
  mode,
  humanSide,
  result,
  totalMoves,
  capturedByWhite,
  capturedByBlack,
  kingsPromotedWhite,
  kingsPromotedBlack,
  onResume,
  onRestart,
  onBackToMenu,
}: GameModalProps) {
  if (phase !== 'PAUSED' && phase !== 'GAME_OVER') {
    return null;
  }

  const isGameOver = phase === 'GAME_OVER' && result !== null;

  let heading = 'Jogo Pausado';
  let subtitle = 'A partida está aguardando seu retorno.';

  if (isGameOver && result) {
    if (result.winner === 'draw') {
      heading = 'Empate';
      subtitle =
        result.reason === 'twenty_moves'
          ? 'Empate pela regra de 20 lances sem capturas ou avanço de pedras.'
          : 'Empate por repetição de posição três vezes.';
    } else {
      const winnerLabel =
        mode === 'ai'
          ? result.winner === humanSide
            ? 'Você Venceu'
            : 'Vitória da IA'
          : result.winner === 'white'
            ? 'Claras Venceram'
            : 'Escuras Venceram';
      heading = winnerLabel;
      subtitle =
        result.reason === 'no_pieces'
          ? 'Todas as peças adversárias foram capturadas.'
          : 'O adversário ficou sem movimentos legais.';
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0807]/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
    >
      <div className="w-full max-w-[400px] rounded-xl bg-[#1E1815] border border-[#4A3428]/70 p-6 sm:p-7 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.9)]">
        <h2
          id="modal-heading"
          className="font-display text-2xl sm:text-3xl font-bold text-[#F5EFE6] text-center"
        >
          {heading}
        </h2>
        <p className="mt-2 text-sm text-[#B8A593] text-center leading-relaxed">{subtitle}</p>

        {/* Match Summary Stats */}
        <div className="mt-6 grid grid-cols-3 gap-2 py-3.5 px-3 rounded-lg bg-[#14100E] border border-[#35261D] text-center">
          <div>
            <div className="text-[11px] text-[#8C7968]">Lances</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-[#F5EFE6] tabular-nums">
              {totalMoves}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#8C7968]">Capturas</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-[#F5EFE6] tabular-nums">
              {capturedByWhite + capturedByBlack}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#8C7968]">Damas</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-[#D99B26] tabular-nums">
              {kingsPromotedWhite + kingsPromotedBlack}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {phase === 'PAUSED' && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 px-4 rounded-lg bg-[#D99B26] hover:bg-[#E5A935] text-[#14110F] font-semibold text-sm transition-colors whitespace-nowrap"
            >
              Continuar Partida
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
              isGameOver
                ? 'bg-[#D99B26] hover:bg-[#E5A935] text-[#14110F]'
                : 'bg-[#2C221C] hover:bg-[#382B24] text-[#F5EFE6] border border-[#4A3428]'
            }`}
          >
            {isGameOver ? 'Jogar Novamente' : 'Reiniciar Partida'}
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-[#2A201B] text-[#C7B7A6] hover:text-[#F5EFE6] font-medium text-sm border border-[#35261D] transition-colors whitespace-nowrap"
          >
            Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
}
