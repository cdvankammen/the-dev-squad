'use client';

import Link from 'next/link';
import { TicTacToe } from '@/components/games/TicTacToe';

export default function TicTacToePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(25,30,45,0.9),rgba(9,9,11,1)_55%)] p-6 text-white">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Games</p>
            <h1 className="mt-1 text-2xl font-bold uppercase tracking-wider text-white">
              Tic-Tac-Toe
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            Back to Squad
          </Link>
        </div>

        {/* Game */}
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,33,0.96),rgba(10,11,18,0.98))] p-6">
          <TicTacToe />
        </div>
      </div>
    </div>
  );
}
