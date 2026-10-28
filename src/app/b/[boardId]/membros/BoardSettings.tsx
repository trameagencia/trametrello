"use client";

import { useTransition } from "react";
import { deleteBoard, updateBoard } from "@/app/actions";
import type { Board } from "@/lib/types";

export function BoardSettings({ board, canDelete }: { board: Board; canDelete: boolean }) {
  const [deleting, startDelete] = useTransition();
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">Quadro</h2>
      <form action={updateBoard.bind(null, board.id)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="name"
          required
          defaultValue={board.name}
          aria-label="Nome do quadro"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="client_name"
          defaultValue={board.client_name ?? ""}
          placeholder="Cliente"
          aria-label="Cliente"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-44"
        />
        <input
          type="color"
          name="color"
          defaultValue={board.color}
          aria-label="Cor do quadro"
          className="h-9 w-12 cursor-pointer rounded-md border border-slate-300"
        />
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Salvar</button>
      </form>
      {canDelete && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-500">Excluir apaga o quadro com todas as colunas, cartões, comentários e anexos.</p>
          <button
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Excluir o quadro "${board.name}"? Isso não pode ser desfeito.`)) return;
              startDelete(() => deleteBoard(board.id));
            }}
            className="shrink-0 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {deleting ? "Excluindo…" : "Excluir quadro"}
          </button>
        </div>
      )}
    </section>
  );
}
