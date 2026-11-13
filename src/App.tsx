import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Lightbulb, Pause, Volume2, VolumeX, Undo2 } from 'lucide-react';
import { CheckerPiece } from './components/CheckerPiece';
import { DamasBoard } from './components/DamasBoard';
import { GameModal } from './components/GameModal';
import { TitleScreen } from './components/TitleScreen';
import { chooseAIMove, getBestHintMove } from './game/ai';
import { soundEngine } from './game/audio';
import {
  applyMove,
  checkGameEnd,
  cloneBoard,
  countPieces,
  createInitialBoard,
  formatMoveNotation,
  getLegalMoves,
  samePos,
  serializeBoard,
} from './game/rules';
import {
  BoardState,
  Difficulty,
  GameEndResult,
  GameMode,
  GamePhase,
  GameSnapshot,
  Move,
  MoveLogEntry,
  Player,
  Position,
  RuleVariant,
} from './game/types';

interface PendingChain {
  origin: Position;
  currentPos: Position;
  stepIndex: number;
  capturedSoFar: Position[];
  matchingMoves: Move[];
}

function createInitialSnapshot(): GameSnapshot {
  const board = createInitialBoard();
  const initialKey = serializeBoard(board, 'white');
  return {
    board,
    turn: 'white',
    capturedByWhite: 0,
    capturedByBlack: 0,
    quietPlies: 0,
    positionCounts: { [initialKey]: 1 },
    moveLog: [],
    lastMove: null,
    kingsPromotedWhite: 0,
    kingsPromotedBlack: 0,
  };
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [variant, setVariant] = useState<RuleVariant>('brazilian');
  const [humanSide, setHumanSide] = useState<Player>('white');
  const [muted, setMuted] = useState<boolean>(false);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(createInitialSnapshot);
  const [history, setHistory] = useState<GameSnapshot[]>([]);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [pendingChain, setPendingChain] = useState<PendingChain | null>(null);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<GameEndResult | null>(null);
  const [aiThinking, setAiThinking] = useState<boolean>(false);

  const moveLogEndRef = useRef<HTMLDivElement | null>(null);

  const aiSide: Player = humanSide === 'white' ? 'black' : 'white';
  const isHumanTurn = mode === 'local' || snapshot.turn === humanSide;
  const boardFlipped = mode === 'ai' && humanSide === 'black';

  // Auto-scroll move history
  useEffect(() => {
    moveLogEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [snapshot.moveLog.length]);

  // Clear ephemeral status notice after 2.2s
  useEffect(() => {
    if (!statusNotice) return;
    const id = window.setTimeout(() => setStatusNotice(null), 2200);
    return () => window.clearTimeout(id);
  }, [statusNotice]);

  const legalMoves = useMemo(
    () => (phase === 'PLAYING' ? getLegalMoves(snapshot.board, snapshot.turn, variant) : []),
    [phase, snapshot.board, snapshot.turn, variant],
  );

  const hasMandatoryCapture = useMemo(
    () => legalMoves.some((m) => m.captures.length > 0),
    [legalMoves],
  );

  const mustCapturePositions = useMemo(() => {
    if (!hasMandatoryCapture || pendingChain) return [];
    const seen = new Set<string>();
    const list: Position[] = [];
    for (const m of legalMoves) {
      const k = `${m.from.row},${m.from.col}`;
      if (!seen.has(k)) {
        seen.add(k);
        list.push(m.from);
      }
    }
    return list;
  }, [hasMandatoryCapture, legalMoves, pendingChain]);

  // Board shown during interactive multi-capture chain
  const displayBoard: BoardState = useMemo(() => {
    if (!pendingChain) return snapshot.board;
    const next = cloneBoard(snapshot.board);
    const movingPiece = next[pendingChain.origin.row][pendingChain.origin.col];
    next[pendingChain.origin.row][pendingChain.origin.col] = null;
    next[pendingChain.currentPos.row][pendingChain.currentPos.col] = movingPiece;
    return next;
  }, [snapshot.board, pendingChain]);

  // Valid target squares for currently selected piece (or active multi-capture chain)
  const validTargets = useMemo(() => {
    if (phase !== 'PLAYING' || !isHumanTurn || aiThinking) return [];

    if (pendingChain) {
      const seen = new Set<string>();
      const targets: { pos: Position; isCapture: boolean }[] = [];
      for (const m of pendingChain.matchingMoves) {
        const nextStep = m.path[pendingChain.stepIndex];
        if (!nextStep) continue;
        const k = `${nextStep.row},${nextStep.col}`;
        if (!seen.has(k)) {
          seen.add(k);
          targets.push({ pos: nextStep, isCapture: true });
        }
      }
      return targets;
    }

    if (!selectedPos) return [];
    const seen = new Set<string>();
    const targets: { pos: Position; isCapture: boolean }[] = [];
    for (const m of legalMoves) {
      if (!samePos(m.from, selectedPos)) continue;
      const step = m.path[0];
      const k = `${step.row},${step.col}`;
      if (!seen.has(k)) {
        seen.add(k);
        targets.push({ pos: step, isCapture: m.captures.length > 0 });
      }
    }
    return targets;
  }, [phase, isHumanTurn, aiThinking, pendingChain, selectedPos, legalMoves]);

  const commitMove = useCallback(
    (move: Move) => {
      const movingPiece = snapshot.board[move.from.row][move.from.col];
      if (!movingPiece) return;

      const nextBoard = applyMove(snapshot.board, move);
      const nextTurn: Player = snapshot.turn === 'white' ? 'black' : 'white';
      const isCapture = move.captures.length > 0;
      const isManMove = !movingPiece.isKing;
      const nextQuietPlies = isCapture || isManMove ? 0 : snapshot.quietPlies + 1;

      const nextKey = serializeBoard(nextBoard, nextTurn);
      const nextPosCounts = {
        ...snapshot.positionCounts,
        [nextKey]: (snapshot.positionCounts[nextKey] ?? 0) + 1,
      };

      const moveNumber = Math.floor(snapshot.moveLog.length / 2) + 1;
      const entry: MoveLogEntry = {
        moveNumber,
        player: snapshot.turn,
        notation: formatMoveNotation(move),
        captureCount: move.captures.length,
        promoted: move.promotes,
      };

      const nextSnapshot: GameSnapshot = {
        board: nextBoard,
        turn: nextTurn,
        capturedByWhite:
          snapshot.capturedByWhite + (snapshot.turn === 'white' ? move.captures.length : 0),
        capturedByBlack:
          snapshot.capturedByBlack + (snapshot.turn === 'black' ? move.captures.length : 0),
        quietPlies: nextQuietPlies,
        positionCounts: nextPosCounts,
        moveLog: [...snapshot.moveLog, entry],
        lastMove: move,
        kingsPromotedWhite:
          snapshot.kingsPromotedWhite + (snapshot.turn === 'white' && move.promotes ? 1 : 0),
        kingsPromotedBlack:
          snapshot.kingsPromotedBlack + (snapshot.turn === 'black' && move.promotes ? 1 : 0),
      };

      setHistory((prev) => [...prev, snapshot]);
      setSnapshot(nextSnapshot);
      setSelectedPos(null);
      setPendingChain(null);
      setHintMove(null);
      setStatusNotice(null);

      // Audio feedback
      if (move.promotes) {
        soundEngine.playKing();
      } else if (isCapture) {
        soundEngine.playCapture(move.captures.length > 1);
      } else {
        soundEngine.playMove();
      }

      // Check end-of-game conditions
      const endResult = checkGameEnd(
        nextBoard,
        nextTurn,
        variant,
        nextQuietPlies,
        nextPosCounts,
      );
      if (endResult) {
        setGameResult(endResult);
        setPhase('GAME_OVER');
        const didHumanWin =
          endResult.winner !== 'draw' &&
          (mode === 'local' || endResult.winner === humanSide);
        soundEngine.playVictory(didHumanWin);
      }
    },
    [snapshot, variant, mode, humanSide],
  );

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (phase !== 'PLAYING' || mode !== 'ai' || snapshot.turn !== aiSide) {
      setAiThinking(false);
      return;
    }

    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const aiMove = chooseAIMove(snapshot.board, aiSide, variant, difficulty);
      setAiThinking(false);
      if (aiMove) {
        commitMove(aiMove);
      }
    }, 480);

    return () => window.clearTimeout(timer);
  }, [phase, mode, snapshot.turn, snapshot.board, aiSide, variant, difficulty, commitMove]);

  const handleSquareClick = useCallback(
    (pos: Position) => {
      if (phase !== 'PLAYING' || !isHumanTurn || aiThinking) return;

      // If mid-multi-capture chain, only allow clicking the next forced capture step
      if (pendingChain) {
        const target = validTargets.find((t) => samePos(t.pos, pos));
        if (!target) {
          setStatusNotice('Continue a captura em cadeia destacada.');
          return;
        }
        const nextMatching = pendingChain.matchingMoves.filter((m) =>
          samePos(m.path[pendingChain.stepIndex], pos),
        );
        const nextStepIndex = pendingChain.stepIndex + 1;
        if (nextMatching.length > 0 && nextMatching[0].path.length === nextStepIndex) {
          commitMove(nextMatching[0]);
        } else if (nextMatching.length > 0) {
          soundEngine.playCapture(true);
          setPendingChain({
            origin: pendingChain.origin,
            currentPos: pos,
            stepIndex: nextStepIndex,
            capturedSoFar: [
              ...pendingChain.capturedSoFar,
              nextMatching[0].captures[pendingChain.stepIndex],
            ],
            matchingMoves: nextMatching,
          });
          setSelectedPos(pos);
        }
        return;
      }

      // Clicking a valid target for the currently selected piece
      if (selectedPos) {
        const target = validTargets.find((t) => samePos(t.pos, pos));
        if (target) {
          const matching = legalMoves.filter(
            (m) => samePos(m.from, selectedPos) && samePos(m.path[0], pos),
          );
          if (matching.length > 0) {
            if (matching[0].path.length === 1) {
              commitMove(matching[0]);
            } else {
              soundEngine.playCapture(true);
              setPendingChain({
                origin: selectedPos,
                currentPos: pos,
                stepIndex: 1,
                capturedSoFar: [matching[0].captures[0]],
                matchingMoves: matching,
              });
              setSelectedPos(pos);
            }
            return;
          }
        }
      }

      // Selecting a piece owned by the current player
      const clickedPiece = snapshot.board[pos.row][pos.col];
      if (clickedPiece && clickedPiece.player === snapshot.turn) {
        if (selectedPos && samePos(selectedPos, pos)) {
          setSelectedPos(null);
          return;
        }
        const movesFromHere = legalMoves.filter((m) => samePos(m.from, pos));
        if (movesFromHere.length > 0) {
          soundEngine.playSelect();
          setSelectedPos(pos);
          setHintMove(null);
        } else if (hasMandatoryCapture) {
          setStatusNotice(
            variant === 'brazilian'
              ? 'Captura obrigatória pela maioria.'
              : 'Captura obrigatória disponível.',
          );
        }
        return;
      }

      setSelectedPos(null);
    },
    [
      phase,
      isHumanTurn,
      aiThinking,
      pendingChain,
      validTargets,
      selectedPos,
      legalMoves,
      snapshot.board,
      snapshot.turn,
      hasMandatoryCapture,
      variant,
      commitMove,
    ],
  );

  const startNewGame = useCallback(() => {
    setSnapshot(createInitialSnapshot());
    setHistory([]);
    setSelectedPos(null);
    setPendingChain(null);
    setHintMove(null);
    setStatusNotice(null);
    setGameResult(null);
    setAiThinking(false);
    setPhase('PLAYING');
  }, []);

  const handleUndo = useCallback(() => {
    if (phase !== 'PLAYING' || aiThinking) return;

    if (pendingChain) {
      setPendingChain(null);
      setSelectedPos(null);
      setStatusNotice('Sequência cancelada.');
      return;
    }

    if (history.length === 0) return;

    // In AI mode, revert back to the human's last decision point
    if (mode === 'ai') {
      let targetIdx = history.length - 1;
      while (targetIdx > 0 && history[targetIdx].turn !== humanSide) {
        targetIdx--;
      }
      if (history[targetIdx].turn !== humanSide) return;
      setSnapshot(history[targetIdx]);
      setHistory(history.slice(0, targetIdx));
    } else {
      const previous = history[history.length - 1];
      setSnapshot(previous);
      setHistory(history.slice(0, -1));
    }

    setSelectedPos(null);
    setPendingChain(null);
    setHintMove(null);
    setStatusNotice(null);
    soundEngine.playSelect();
  }, [phase, aiThinking, pendingChain, history, mode, humanSide]);

  const handleHint = useCallback(() => {
    if (phase !== 'PLAYING' || !isHumanTurn || aiThinking || pendingChain) return;
    const best = getBestHintMove(snapshot.board, snapshot.turn, variant);
    if (best) {
      setHintMove(best);
      setSelectedPos(best.from);
      soundEngine.playSelect();
    }
  }, [phase, isHumanTurn, aiThinking, pendingChain, snapshot.board, snapshot.turn, variant]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Global keyboard shortcuts during play/pause
  useEffect(() => {
    if (phase === 'TITLE_MENU') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'PLAYING') setPhase('PAUSED');
        else if (phase === 'PAUSED') setPhase('PLAYING');
      } else if ((e.key === 'h' || e.key === 'H') && phase === 'PLAYING') {
        e.preventDefault();
        handleHint();
      } else if ((e.key === 'z' || e.key === 'Z') && phase === 'PLAYING') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleHint, handleUndo, handleToggleMute]);

  if (phase === 'TITLE_MENU') {
    return (
      <TitleScreen
        mode={mode}
        difficulty={difficulty}
        variant={variant}
        humanSide={humanSide}
        onModeChange={setMode}
        onDifficultyChange={setDifficulty}
        onVariantChange={setVariant}
        onHumanSideChange={setHumanSide}
        onStart={startNewGame}
      />
    );
  }

  const counts = countPieces(snapshot.board);
  const whiteCount = counts.whiteMen + counts.whiteKings;
  const blackCount = counts.blackMen + counts.blackKings;

  const topPlayer: Player = boardFlipped ? 'white' : 'black';
  const bottomPlayer: Player = boardFlipped ? 'black' : 'white';

  const getPlayerLabel = (p: Player) => {
    if (mode === 'local') {
      return p === 'white' ? 'Claras · Jogador 1' : 'Escuras · Jogador 2';
    }
    if (p === humanSide) {
      return p === 'white' ? 'Claras · Você' : 'Escuras · Você';
    }
    const diffText =
      difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Médio' : 'Difícil';
    return p === 'white' ? `Claras · IA (${diffText})` : `Escuras · IA (${diffText})`;
  };

  const getRemainingCount = (p: Player) => (p === 'white' ? whiteCount : blackCount);
  const getCapturedCount = (p: Player) =>
    p === 'white' ? snapshot.capturedByWhite : snapshot.capturedByBlack;

  const canUndo =
    !aiThinking &&
    (pendingChain !== null ||
      (mode === 'local' ? history.length > 0 : history.some((h) => h.turn === humanSide)));

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-x-hidden bg-[#14110F] text-[#F5EFE6]">
      {/* Subtle tabletop background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <img
          src="/src/assets/images/parlor_walnut_table_1794589515074.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#110E0C]/85 via-[#14110F]/65 to-[#0D0A09]/90" />
      </div>

      {/* Main Arena Wrapper */}
      <div className="relative z-10 w-full max-w-[1060px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row items-center justify-center gap-5 lg:gap-8">
        {/* Left/Center: Opponent Bar + Board + Player Bar + Action Bar */}
        <div className="flex flex-col items-center gap-2.5 sm:gap-3">
          {/* Top Opponent Perimeter Bar */}
          <div className="w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#1C1613]/92 border border-[#3E2D23]">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckerPiece piece={{ player: topPlayer, isKing: false }} size="mini" />
              <span className="text-sm font-medium text-[#EFE6DA] truncate">
                {getPlayerLabel(topPlayer)}
              </span>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-xs">
              <span className="text-[#A68E7A] tabular-nums">
                Peças:{' '}
                <strong className="font-mono text-sm text-[#F5EFE6]">
                  {getRemainingCount(topPlayer)}
                </strong>
              </span>
              {getCapturedCount(topPlayer) > 0 && (
                <span className="font-mono text-[#D99B26] tabular-nums">
                  +{getCapturedCount(topPlayer)}
                </span>
              )}
              <span
                className={`font-medium whitespace-nowrap ${
                  snapshot.turn === topPlayer ? 'text-[#E3A93B]' : 'text-[#736355]'
                }`}
              >
                {snapshot.turn === topPlayer
                  ? aiThinking
                    ? 'Pensando...'
                    : 'Em turno'
                  : 'Aguardando'}
              </span>
            </div>
          </div>

          {/* Interactive Wooden Board */}
          <DamasBoard
            board={displayBoard}
            turn={snapshot.turn}
            flipped={boardFlipped}
            selectedPos={selectedPos}
            mustCapturePositions={isHumanTurn ? mustCapturePositions : []}
            validTargets={validTargets}
            pendingCaptured={pendingChain?.capturedSoFar ?? []}
            lastMove={snapshot.lastMove}
            hintMove={hintMove}
            disabled={phase !== 'PLAYING' || !isHumanTurn || aiThinking}
            onSquareClick={handleSquareClick}
          />

          {/* Bottom Player Perimeter Bar */}
          <div className="w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#1C1613]/92 border border-[#3E2D23]">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckerPiece piece={{ player: bottomPlayer, isKing: false }} size="mini" />
              <span className="text-sm font-medium text-[#EFE6DA] truncate">
                {getPlayerLabel(bottomPlayer)}
              </span>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-xs">
              <span className="text-[#A68E7A] tabular-nums">
                Peças:{' '}
                <strong className="font-mono text-sm text-[#F5EFE6]">
                  {getRemainingCount(bottomPlayer)}
                </strong>
              </span>
              {getCapturedCount(bottomPlayer) > 0 && (
                <span className="font-mono text-[#D99B26] tabular-nums">
                  +{getCapturedCount(bottomPlayer)}
                </span>
              )}
              <span
                className={`font-medium whitespace-nowrap ${
                  snapshot.turn === bottomPlayer ? 'text-[#E3A93B]' : 'text-[#736355]'
                }`}
              >
                {snapshot.turn === bottomPlayer ? 'Em turno' : 'Aguardando'}
              </span>
            </div>
          </div>

          {/* Perimeter Controls Row */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHint}
                disabled={phase !== 'PLAYING' || !isHumanTurn || aiThinking || pendingChain !== null}
                title="Sugerir jogada (H)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#221B17] hover:bg-[#2F2520] disabled:opacity-40 text-xs sm:text-sm font-medium text-[#EFE6DA] border border-[#3E2D23] transition-colors whitespace-nowrap"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[#D99B26]" aria-hidden="true" />
                <span>Dica</span>
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Desfazer lance (Z)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#221B17] hover:bg-[#2F2520] disabled:opacity-40 text-xs sm:text-sm font-medium text-[#EFE6DA] border border-[#3E2D23] transition-colors whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5 text-[#C7B7A6]" aria-hidden="true" />
                <span>Desfazer</span>
              </button>
            </div>

            <div className="text-xs text-[#E3A93B] font-medium min-h-[1rem] text-center">
              {statusNotice ??
                (pendingChain
                  ? 'Continue a captura múltipla.'
                  : hasMandatoryCapture && isHumanTurn && !aiThinking
                    ? 'Captura obrigatória disponível.'
                    : '')}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Ativar som' : 'Silenciar som'}
                title="Som (M)"
                className="inline-flex items-center justify-center p-2 rounded-lg bg-[#221B17] hover:bg-[#2F2520] text-[#EFE6DA] border border-[#3E2D23] transition-colors"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-[#8C7968]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#D99B26]" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPhase('PAUSED')}
                title="Pausar (Esc)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#221B17] hover:bg-[#2F2520] text-xs sm:text-sm font-medium text-[#EFE6DA] border border-[#3E2D23] transition-colors whitespace-nowrap"
              >
                <Pause className="w-3.5 h-3.5 text-[#C7B7A6]" aria-hidden="true" />
                <span>Pausar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Side Panel: Rule Info & Move Log */}
        <aside
          aria-label="Histórico e informações da partida"
          className="hidden lg:flex flex-col w-[260px] h-[560px] rounded-xl bg-[#1C1613]/92 border border-[#3E2D23] p-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#33251D]">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F5EFE6] leading-tight">
                Damas
              </h2>
              <p className="text-xs text-[#A68E7A] mt-0.5">
                Regra {variant === 'brazilian' ? 'Brasileira' : 'Americana'} · 8×8
              </p>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              title="Reiniciar partida"
              className="p-2 rounded-lg text-[#B8A593] hover:text-[#F5EFE6] hover:bg-[#2A201B] transition-colors"
              aria-label="Reiniciar partida"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[#A68E7A]">
            <span>Histórico de lances</span>
            <span className="font-mono tabular-nums">{snapshot.moveLog.length}</span>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs tabular-nums">
            {snapshot.moveLog.length === 0 ? (
              <p className="text-[#736355] font-sans text-xs pt-4">
                As claras iniciam a partida. Selecione uma peça destacada para mover.
              </p>
            ) : (
              Array.from({ length: Math.ceil(snapshot.moveLog.length / 2) }).map((_, pairIdx) => {
                const whiteMove = snapshot.moveLog[pairIdx * 2];
                const blackMove = snapshot.moveLog[pairIdx * 2 + 1];
                return (
                  <div
                    key={pairIdx}
                    className="grid grid-cols-[28px_1fr_1fr] items-center py-1 px-1.5 rounded bg-[#15110F]/60"
                  >
                    <span className="text-[#736355]">{pairIdx + 1}.</span>
                    <span className="text-[#EFE6DA]">
                      {whiteMove.notation}
                      {whiteMove.promoted ? ' ♛' : ''}
                    </span>
                    <span className="text-[#B8A593]">
                      {blackMove ? `${blackMove.notation}${blackMove.promoted ? ' ♛' : ''}` : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={moveLogEndRef} />
          </div>

          <div className="pt-3 mt-3 border-t border-[#33251D] text-[11px] text-[#8C7968] flex items-center justify-between">
            <span>Sem captura:</span>
            <span className="font-mono tabular-nums">{Math.floor(snapshot.quietPlies / 2)}/20</span>
          </div>
        </aside>
      </div>

      {/* Pause / Game Over Modal */}
      <GameModal
        phase={phase}
        mode={mode}
        humanSide={humanSide}
        result={gameResult}
        totalMoves={snapshot.moveLog.length}
        capturedByWhite={snapshot.capturedByWhite}
        capturedByBlack={snapshot.capturedByBlack}
        kingsPromotedWhite={snapshot.kingsPromotedWhite}
        kingsPromotedBlack={snapshot.kingsPromotedBlack}
        onResume={() => setPhase('PLAYING')}
        onRestart={startNewGame}
        onBackToMenu={() => {
          setAiThinking(false);
          setPhase('TITLE_MENU');
        }}
      />
    </div>
  );
}
