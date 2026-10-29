"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CardSummary, Permissions } from "@/lib/types";
import { formatDateTime } from "./ui";

type Props = {
  boardId: string;
  permissions: Permissions;
  onClose: () => void;
  onOpen: (card: CardSummary) => void;
  onChanged: () => void;
};

/** Painel lateral com os cartões arquivados do quadro: abrir, restaurar ou excluir de vez. */
export function ArchivedPanel({ boardId, permissions, onClose, onOpen, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [query, setQuery] = useState("");

  const fetchCards = useCallback(async () => {
    const { data } = await supabase
      .from("cards")
      .select("*, card_assignees(user_id)")
      .eq("board_id", boardId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    return ((data ?? []) as (CardSummary & { card_assignees: { user_id: string }[] })[]).map(({ card_assignees, ...c }) => ({
      ...c,
      checklist_total: 0,
      checklist_done: 0,
      comment_count: 0,
      attachment_count: 0,
      assignee_ids: card_assignees.map((a) => a.user_id),
    }));
  }, [supabase, boardId]);

  useEffect(() => {
    let active = true;
    fetchCards().then((c) => active && setCards(c));
    return () => {
      active = false;
    };
  }, [fetchCards]);

  async function restore(card: CardSummary) {
    await supabase.from("cards").update({ archived_at: null }).eq("id", card.id);
    setCards(await fetchCards());
    onChanged();
  }

  async function remove(card: CardSummary) {
    if (!confirm(`Excluir de vez o cartão "${card.title}"? Isso não pode ser desfeito.`)) return;
    await supabase.from("cards").delete().eq("id", card.id);
    setCards(await fetchCards());
  }

  const filtered = (cards ?? []).filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside
        className="animate-sheet flex h-full w-full max-w-sm flex-col bg-white/95 shadow-2xl backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Arquivados</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-black/5" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="px-5 pb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-xl bg-black/[0.05] px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-accent/15"
          />
        </div>
        <ul className="scroll-soft flex-1 space-y-2 overflow-y-auto px-5 pb-5">
          {cards === null && <li className="text-sm text-ink-2">Carregando…</li>}
          {cards !== null && filtered.length === 0 && (
            <li className="rounded-xl bg-black/[0.03] p-4 text-sm text-ink-2">Nenhum cartão arquivado.</li>
          )}
          {filtered.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.06)]">
              <button onClick={() => onOpen(c)} className="block w-full text-left text-sm font-medium text-ink hover:underline">
                {c.title}
              </button>
              <div className="mt-1 text-xs text-ink-3">Arquivado em {formatDateTime(c.archived_at!)}</div>
              {permissions.canEdit && (
                <div className="mt-2 flex gap-3 text-xs font-medium">
                  <button onClick={() => restore(c)} className="text-accent hover:underline">
                    Restaurar
                  </button>
                  <button onClick={() => remove(c)} className="text-[#d70015] hover:underline">
                    Excluir de vez
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
