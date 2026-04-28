'use client';

import { useState } from 'react';
import clsx from 'clsx';

type Player = 'X' | 'O';
type Cell = Player | null;
type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
type GameStatus = 'playing' | 'won' | 'draw';

const WIN_COMBINATIONS: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: Board): { winner: Player; line: [number, number, number] } | null {
  for (const [a, b, c] of WIN_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line: [a, b, c] };
    }
  }
  return null;
}

function checkDraw(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

interface GameState {
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winLine: [number, number, number] | null;
  scores: Record<Player, number>;
  draws: number;
}

const EMPTY_BOARD: Board = [null, null, null, null, null, null, null, null, null];

function createInitialState(
  scores?: Record<Player, number>,
  draws?: number,
): GameState {
  return {
    board: [...EMPTY_BOARD] as Board,
    currentPlayer: 'X',
    status: 'playing',
    winner: null,
    winLine: null,
    scores: scores ?? { X: 0, O: 0 },
    draws: draws ?? 0,
  };
}

export function TicTacToe() {
  const [game, setGame] = useState<GameState>(() => createInitialState());

  function handleCellClick(index: number) {
    if (game.status !== 'playing' || game.board[index] !== null) return;

    const newBoard = [...game.board] as Board;
    newBoard[index] = game.currentPlayer;

    const winResult = checkWinner(newBoard);
    const isDraw = !winResult && checkDraw(newBoard);
    const newStatus: GameStatus = winResult ? 'won' : isDraw ? 'draw' : 'playing';
    const newScores = { ...game.scores };
    const newDraws = isDraw ? game.draws + 1 : game.draws;

    if (winResult) {
      newScores[winResult.winner] += 1;
    }

    setGame({
      board: newBoard,
      currentPlayer: game.currentPlayer === 'X' ? 'O' : 'X',
      status: newStatus,
      winner: winResult?.winner ?? null,
      winLine: winResult?.line ?? null,
      scores: newScores,
      draws: newDraws,
    });
  }

  function handleNewGame() {
    setGame(createInitialState(game.scores, game.draws));
  }

  function handleResetAll() {
    setGame(createInitialState());
  }

  const statusMessage = (() => {
    if (game.status === 'won') return `Player ${game.winner} wins!`;
    if (game.status === 'draw') return "It's a draw!";
    return `Player ${game.currentPlayer}'s turn`;
  })();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Scoreboard */}
      <div className="flex w-full max-w-sm gap-4">
        {(['X', 'O'] as Player[]).map((player) => (
          <div
            key={player}
            className={clsx(
              'flex-1 rounded-xl border px-4 py-3 text-center transition-all',
              game.status === 'won' && game.winner === player
                ? player === 'X'
                  ? 'border-violet-500/60 bg-violet-500/15 shadow-[0_0_16px_rgba(139,92,246,0.15)]'
                  : 'border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_16px_rgba(34,197,94,0.15)]'
                : game.status === 'playing' && game.currentPlayer === player
                  ? player === 'X'
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-white/10 bg-white/5',
            )}
          >
            <div
              className={clsx(
                'text-2xl font-bold',
                player === 'X' ? 'text-violet-400' : 'text-emerald-400',
              )}
            >
              {player}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Player</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-white">
              {game.scores[player]}
            </div>
          </div>
        ))}
        <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-400">—</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Draws</div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-white">{game.draws}</div>
        </div>
      </div>

      {/* Status message */}
      <div
        className={clsx(
          'rounded-xl border px-5 py-2.5 text-sm font-semibold uppercase tracking-wider transition-all',
          game.status === 'won' && game.winner === 'X'
            ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
            : game.status === 'won' && game.winner === 'O'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : game.status === 'draw'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : game.currentPlayer === 'X'
                  ? 'border-violet-500/20 bg-white/5 text-slate-300'
                  : 'border-emerald-500/20 bg-white/5 text-slate-300',
        )}
      >
        {statusMessage}
      </div>

      {/* Board */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {game.board.map((cell, index) => {
          const isWinCell = game.winLine?.includes(index) ?? false;
          return (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={cell !== null || game.status !== 'playing'}
              aria-label={cell ? `Cell ${index + 1}: ${cell}` : `Cell ${index + 1}: empty`}
              className={clsx(
                'flex h-20 w-20 items-center justify-center rounded-xl border text-3xl font-bold transition-all disabled:cursor-not-allowed',
                isWinCell && cell === 'X'
                  ? 'border-violet-500/60 bg-violet-500/20 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                  : isWinCell && cell === 'O'
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                    : cell === 'X'
                      ? 'border-white/10 bg-white/5 text-violet-400'
                      : cell === 'O'
                        ? 'border-white/10 bg-white/5 text-emerald-400'
                        : game.status === 'playing'
                          ? 'cursor-pointer border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                          : 'border-white/10 bg-white/5',
              )}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleNewGame}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          New Game
        </button>
        <button
          onClick={handleResetAll}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/10"
        >
          Reset Scores
        </button>
      </div>
    </div>
  );
}
