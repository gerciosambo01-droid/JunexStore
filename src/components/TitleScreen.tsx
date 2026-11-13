import { useEffect } from 'react';
import { createInitialBoard, isDarkSquare } from '../game/rules';
import { Difficulty, GameMode, Player, RuleVariant } from '../game/types';
import { CheckerPiece } from './CheckerPiece';

interface TitleScreenProps {
  mode: GameMode;
  difficulty: Difficulty;
  variant: RuleVariant;
  humanSide: Player;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onVariantChange: (variant: RuleVariant) => void;
  onHumanSideChange: (side: Player) => void;
  onStart: () => void;
}

const PREVIEW_BOARD = createInitialBoard();

export function TitleScreen({
  mode,
  difficulty,
  variant,
  humanSide,
  onModeChange,
  onDifficultyChange,
  onVariantChange,
  onHumanSideChange,
  onStart,
}: TitleScreenProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON') return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  return (
    <main className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[#14110F] text-[#F5EFE6]">
      {/* Walnut tabletop backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <img
          src="/src/assets/images/parlor_walnut_table_1794589515074.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#14110F]/90 via-[#14110F]/65 to-[#0D0A09]/92" />
      </div>

      {/* Main Split Stage */}
      <div className="relative z-10 flex-1 w-full max-w-[1160px] mx-auto px-6 sm:px-10 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16">
        {/* Left: Bespoke Title Lockup + Live Board Showcase */}
        <div className="w-full lg:w-[50%] flex flex-col items-center lg:items-start">
          {/* Bespoke SVG Title Lockup */}
          <div className="flex items-center gap-4 mb-6">
            <svg
              viewBox="0 0 64 64"
              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-md"
              aria-hidden="true"
            >
              <circle cx="32" cy="32" r="29" fill="#271A14" stroke="#D99B26" strokeWidth="2.5" />
              <circle cx="32" cy="32" r="22" fill="none" stroke="#8C6A4A" strokeWidth="1.2" opacity="0.7" />
              <path
                fill="#E3A93B"
                d="M19 42h26v3.5H19V42zm.5-3.5L17.5 24l8.8 6.5L32 19l5.7 11.5L46.5 24l-2 14.5h-25z"
              />
            </svg>
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#F5EFE6] leading-none">
                Damas
              </h1>
              <p className="mt-1.5 text-sm text-[#C7B7A6]">
                Tabuleiro clássico em madeira artesanal
              </p>
            </div>
          </div>

          {/* Non-interactive tactile board centerpiece */}
          <div
            className="hidden sm:block p-2.5 rounded-xl bg-[#271A14] border border-[#4A3428]/70 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]"
            aria-hidden="true"
          >
            <div className="w-[340px] xl:w-[390px] aspect-square grid grid-cols-8 grid-rows-8 rounded-[3px] overflow-hidden border border-[#140D0A]">
              {PREVIEW_BOARD.map((row, r) =>
                row.map((piece, c) => {
                  const dark = isDarkSquare(r, c);
                  return (
                    <div
                      key={`prev-${r}-${c}`}
                      className={`flex items-center justify-center ${
                        dark ? 'bg-[#5A3B2B]' : 'bg-[#EADBC8]'
                      }`}
                    >
                      {piece && <CheckerPiece piece={piece} />}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        {/* Right: Match Configuration & Start CTA */}
        <section
          aria-label="Configuração da Partida"
          className="w-full max-w-[420px] bg-[#1C1613]/92 border border-[#4A3428]/60 rounded-xl p-6 sm:p-7 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)]"
        >
          <div className="space-y-5">
            {/* Mode */}
            <div>
              <span className="block text-xs font-medium text-[#B8A593] mb-2">
                Modo de jogo
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#120E0C] border border-[#35261D]">
                <button
                  type="button"
                  onClick={() => onModeChange('ai')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    mode === 'ai'
                      ? 'bg-[#D99B26] text-[#14110F] shadow-sm'
                      : 'text-[#C7B7A6] hover:text-[#F5EFE6]'
                  }`}
                >
                  Contra IA
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('local')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    mode === 'local'
                      ? 'bg-[#D99B26] text-[#14110F] shadow-sm'
                      : 'text-[#C7B7A6] hover:text-[#F5EFE6]'
                  }`}
                >
                  2 Jogadores
                </button>
              </div>
            </div>

            {/* Difficulty & Side when playing vs AI */}
            {mode === 'ai' && (
              <>
                <div>
                  <span className="block text-xs font-medium text-[#B8A593] mb-2">
                    Dificuldade da IA
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#120E0C] border border-[#35261D]">
                    {([
                      { id: 'easy', label: 'Fácil' },
                      { id: 'medium', label: 'Médio' },
                      { id: 'hard', label: 'Difícil' },
                    ] as const).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => onDifficultyChange(lvl.id)}
                        className={`py-2 px-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          difficulty === lvl.id
                            ? 'bg-[#2E231D] text-[#F5EFE6] border border-[#6E513F]'
                            : 'text-[#A68E7A] hover:text-[#F5EFE6] border border-transparent'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#B8A593] mb-2">
                    Sua cor
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#120E0C] border border-[#35261D]">
                    <button
                      type="button"
                      onClick={() => onHumanSideChange('white')}
                      className={`py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                        humanSide === 'white'
                          ? 'bg-[#2E231D] text-[#F5EFE6] border border-[#6E513F]'
                          : 'text-[#A68E7A] hover:text-[#F5EFE6] border border-transparent'
                      }`}
                    >
                      <CheckerPiece piece={{ player: 'white', isKing: false }} size="mini" />
                      <span>Claras (1º)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onHumanSideChange('black')}
                      className={`py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                        humanSide === 'black'
                          ? 'bg-[#2E231D] text-[#F5EFE6] border border-[#6E513F]'
                          : 'text-[#A68E7A] hover:text-[#F5EFE6] border border-transparent'
                      }`}
                    >
                      <CheckerPiece piece={{ player: 'black', isKing: false }} size="mini" />
                      <span>Escuras (2º)</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Rule Variant */}
            <div>
              <span className="block text-xs font-medium text-[#B8A593] mb-2">
                Regra do tabuleiro
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#120E0C] border border-[#35261D]">
                <button
                  type="button"
                  onClick={() => onVariantChange('brazilian')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    variant === 'brazilian'
                      ? 'bg-[#2E231D] text-[#F5EFE6] border border-[#6E513F]'
                      : 'text-[#A68E7A] hover:text-[#F5EFE6] border border-transparent'
                  }`}
                >
                  Brasileira
                </button>
                <button
                  type="button"
                  onClick={() => onVariantChange('american')}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    variant === 'american'
                      ? 'bg-[#2E231D] text-[#F5EFE6] border border-[#6E513F]'
                      : 'text-[#A68E7A] hover:text-[#F5EFE6] border border-transparent'
                  }`}
                >
                  Americana
                </button>
              </div>
              <p className="mt-2 text-xs text-[#9C8876] leading-relaxed">
                {variant === 'brazilian'
                  ? 'Dama longa, captura para trás permitida e captura obrigatória pela maioria.'
                  : 'Dama de 1 casa, captura simples obrigatória apenas para frente em pedras comuns.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onStart}
              className="w-full py-3.5 px-6 rounded-lg bg-[#D99B26] hover:bg-[#E5A935] active:scale-[0.99] text-[#14110F] font-semibold text-base transition-all duration-150 shadow-[0_10px_25px_-6px_rgba(217,155,38,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5EFE6]"
            >
              Jogar Partida
            </button>
          </div>
        </section>
      </div>

      {/* Single flat control-hint line */}
      <footer className="relative z-10 pb-5 px-6 text-center">
        <p className="text-xs text-[#8C7968] tracking-wide">
          Enter Iniciar <span aria-hidden="true">·</span> Clique para mover{' '}
          <span aria-hidden="true">·</span> H Dica <span aria-hidden="true">·</span> Z Desfazer{' '}
          <span aria-hidden="true">·</span> M Som <span aria-hidden="true">·</span> Esc Pausar
        </p>
      </footer>
    </main>
  );
}
