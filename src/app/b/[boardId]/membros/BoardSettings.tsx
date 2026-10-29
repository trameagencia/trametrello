"use client";
import { useTransition } from "react";
import { deleteBoard, updateBoard } from "@/app/actions";
import type { Board } from "@/lib/types";
import { buttonDanger, buttonPrimary, inputBase } from "@/components/ui";

export function BoardSettings({ board, canDelete }: { board: Board; canDelete: boolean }) {
  const [deleting, startDelete] = useTransition();
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">Quadro</h2>
      <form action={updateBoard.bind(null, board.id)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="name"
          required
          defaultValue={board.name}
          aria-label="Nome do quadro"
          className={`flex-1 ${inputBase}`}
        />
        <input
          name="client_name"
          defaultValue={board.client_name ?? ""}
          placeholder="Cliente"
          aria-label="Cliente"
          className={`${inputBase} sm:w-44`}
        />
        <input
          type="color"
          name="color"
          defaultValue={board.color}
          aria-label="Cor do quadro"
          className="h-9 w-12 cursor-pointer rounded-xl border border-line bg-white p-1"
        />
        <button className={`${buttonPrimary}`}>Salvar</button>
      </form>
      {canDelete && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-ink-2">Excluir apaga o quadro com todas as colunas, cartões, comentários e anexos.</p>
          <button
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Excluir o quadro "${board.name}"? Isso não pode ser desfeito.`)) return;
              startDelete(() => deleteBoard(board.id));
            }}
            className={`${buttonDanger}`}
          >
            {deleting ? "Excluindo…" : "Excluir quadro"}
          </button>
        </div>
      )}
    </section>
  );
}
