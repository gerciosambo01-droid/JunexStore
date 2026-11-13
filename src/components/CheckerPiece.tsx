import { Piece } from '../game/types';

interface CheckerPieceProps {
  piece: Piece;
  isSelected?: boolean;
  isMustCapture?: boolean;
  isPendingCaptured?: boolean;
  size?: 'board' | 'mini';
}

export function CheckerPiece({
  piece,
  isSelected = false,
  isMustCapture = false,
  isPendingCaptured = false,
  size = 'board',
}: CheckerPieceProps) {
  const isWhite = piece.player === 'white';

  if (size === 'mini') {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${
          isWhite
            ? 'piece-ivory border-[#C8B7A0] text-[#5A3B2B]'
            : 'piece-ebony border-[#3D3530] text-[#D99B26]'
        }`}
        aria-hidden="true"
      >
        {piece.isKing && (
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
            <path d="M5 17h14v2H5v-2zm0-2l-1-8 5 4 3-6 3 6 5-4-1 8H5z" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <div
      className={`relative w-[78%] h-[78%] rounded-full flex items-center justify-center transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
        isWhite ? 'piece-ivory border border-[#C7B59B]' : 'piece-ebony border border-[#423833]'
      } ${isSelected ? '-translate-y-1 scale-[1.07] ring-2 ring-[#D99B26]' : ''} ${
        isMustCapture && !isSelected ? 'ring-2 ring-[#D99B26]/80' : ''
      } ${isPendingCaptured ? 'opacity-35 scale-90' : 'opacity-100'}`}
    >
      {/* Concentric turned-wood lathe grooves */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={isWhite ? 'rgba(130, 102, 74, 0.24)' : 'rgba(255, 238, 218, 0.12)'}
          strokeWidth="1.5"
        />
        <circle
          cx="50"
          cy="50"
          r="26"
          fill="none"
          stroke={isWhite ? 'rgba(130, 102, 74, 0.18)' : 'rgba(255, 238, 218, 0.08)'}
          strokeWidth="1.2"
        />
      </svg>

      {/* Inlaid brass crown for Damas (Kings) */}
      {piece.isKing && (
        <svg
          viewBox="0 0 24 24"
          className={`relative z-10 w-[52%] h-[52%] drop-shadow-sm ${
            isWhite ? 'text-[#A87214]' : 'text-[#E3A93B]'
          }`}
          aria-label="Dama"
        >
          <path
            fill="currentColor"
            d="M4.5 17.5h15v2h-15v-2zm.5-2.2L3.5 7.5l5.2 3.8L12 5l3.3 6.3 5.2-3.8-1.5 7.8H5z"
          />
        </svg>
      )}
    </div>
  );
}
