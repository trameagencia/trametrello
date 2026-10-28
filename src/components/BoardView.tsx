"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import {
  positionBetween,
  type Board,
  type CardSummary,
  type Column,
  type Member,
  type Permissions,
} from "@/lib/types";
import { CardModal } from "./CardModal";
import { Avatar, LabelChip, LockIcon, formatDate } from "./ui";

type Props = {
  board: Board;
  columns: Column[];
  cards: CardSummary[];
  members: Member[];
  permissions: Permissions;
  currentUserId: string;
};

type Layout = Record<string, string[]>;

function buildLayout(columns: Column[], cards: CardSummary[]): Layout {
  const layout: Layout = Object.fromEntries(columns.map((c) => [c.id, [] as string[]]));
  [...cards]
    .sort((a, b) => a.position - b.position)
    .forEach((card) => layout[card.column_id]?.push(card.id));
  return layout;
}

export function BoardView({ board, columns, cards, members, permissions, currentUserId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [viewAsClient, setViewAsClient] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [cardMap, setCardMap] = useState(() => new Map(cards.map((c) => [c.id, c])));
  const [layout, setLayout] = useState(() => buildLayout(columns, cards));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Os dados do servidor mudaram (router.refresh): recomeça a partir deles.
  const [synced, setSynced] = useState({ columns, cards });
  if (synced.columns !== columns || synced.cards !== cards) {
    setSynced({ columns, cards });
    setCardMap(new Map(cards.map((c) => [c.id, c])));
    setLayout(buildLayout(columns, cards));
  }

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);

  // Tempo real: qualquer mudança visível para mim no quadro recarrega os dados.
  // Também recarrega ao voltar para a aba e a cada 30s, porque um cartão que sai
  // da minha visão (ex.: movido para a coluna da equipe) não gera evento para mim.
  useEffect(() => {
    const channel = supabase
      .channel(`board:${board.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${board.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "columns", filter: `board_id=eq.${board.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, refresh)
      .subscribe();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(refresh, 30_000);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [supabase, board.id, refresh]);

  const visibleColumns = columns.filter((c) => !(viewAsClient && c.team_only));
  const canDrag = permissions.canComment;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  function columnOf(id: string) {
    if (id in layout) return id;
    return Object.keys(layout).find((col) => layout[col].includes(id));
  }

  function onDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = columnOf(activeId);
    const to = columnOf(overId);
    if (!from || !to || from === to) return;
    setLayout((prev) => {
      const fromItems = prev[from].filter((id) => id !== activeId);
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(overId);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, activeId);
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const col = columnOf(activeId);
    if (!col || !overId) return;

    let items = layout[col];
    const oldIndex = items.indexOf(activeId);
    const overIndex = items.indexOf(overId);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      items = [...items];
      items.splice(oldIndex, 1);
      items.splice(overIndex, 0, activeId);
      setLayout((prev) => ({ ...prev, [col]: items }));
    }
    const index = items.indexOf(activeId);
    const before = cardMap.get(items[index - 1])?.position;
    const after = cardMap.get(items[index + 1])?.position;
    const position = positionBetween(before, after);
    const card = cardMap.get(activeId);
    if (!card || (card.column_id === col && card.position === position)) return;

    setCardMap((prev) => new Map(prev).set(activeId, { ...card, column_id: col, position }));
    const { error } = await supabase.rpc("move_card", { p_card: activeId, p_column: col, p_position: position });
    if (error) setError(error.message);
    refresh();
  }

  async function addColumn() {
    const name = prompt("Nome da nova coluna");
    if (!name?.trim()) return;
    const last = columns[columns.length - 1];
    const { error } = await supabase
      .from("columns")
      .insert({ board_id: board.id, name: name.trim(), position: positionBetween(last?.position) });
    if (error) setError(error.message);
    refresh();
  }

  const openCard = openCardId ? cardMap.get(openCardId) : undefined;

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 px-4 py-2 text-sm text-white">
        {permissions.isTeam && (
          <label className="flex cursor-pointer items-center gap-2 rounded bg-black/20 px-3 py-1.5 hover:bg-black/30">
            <input type="checkbox" checked={viewAsClient} onChange={(e) => setViewAsClient(e.target.checked)} />
            Ver como cliente
          </label>
        )}
        {viewAsClient && <span className="text-white/80">Colunas só da equipe estão escondidas, como o cliente vê.</span>}
        {error && (
          <button onClick={() => setError(null)} className="ml-auto rounded bg-red-600 px-3 py-1.5">
            {error} ✕
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDraggingId(null);
          setLayout(buildLayout(columns, [...cardMap.values()]));
        }}
      >
        <div className="flex flex-1 items-start gap-3 overflow-x-auto px-4 pb-4">
          {visibleColumns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              cardIds={layout[column.id] ?? []}
              cardMap={cardMap}
              members={members}
              permissions={permissions}
              canDrag={canDrag}
              onOpen={setOpenCardId}
              onChanged={refresh}
              onError={setError}
            />
          ))}
          {permissions.isTeam && !viewAsClient && (
            <button
              onClick={addColumn}
              className="w-72 shrink-0 rounded-xl bg-white/20 px-3 py-2.5 text-left text-sm font-medium text-white hover:bg-white/30"
            >
              + Adicionar coluna
            </button>
          )}
        </div>
        <DragOverlay>
          {draggingId && cardMap.get(draggingId) ? (
            <CardTile card={cardMap.get(draggingId)!} members={members} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardModal
          card={openCard}
          columns={columns.filter((c) => permissions.isTeam || !c.team_only)}
          members={members}
          permissions={permissions}
          currentUserId={currentUserId}
          onClose={() => setOpenCardId(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}

function ColumnView({
  column,
  cardIds,
  cardMap,
  members,
  permissions,
  canDrag,
  onOpen,
  onChanged,
  onError,
}: {
  column: Column;
  cardIds: string[];
  cardMap: Map<string, CardSummary>;
  members: Member[];
  permissions: Permissions;
  canDrag: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { setNodeRef } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const last = cardMap.get(cardIds[cardIds.length - 1]);
    const { error } = await supabase.from("cards").insert({
      board_id: column.board_id,
      column_id: column.id,
      title: title.trim(),
      position: positionBetween(last?.position),
    });
    if (error) onError(error.message);
    setTitle("");
    onChanged();
  }

  async function updateColumn(patch: Partial<Column>) {
    setMenuOpen(false);
    const { error } = await supabase.from("columns").update(patch).eq("id", column.id);
    if (error) onError(error.message);
    onChanged();
  }

  async function rename() {
    const name = prompt("Novo nome da coluna", column.name);
    if (name?.trim()) await updateColumn({ name: name.trim() });
  }

  async function remove() {
    setMenuOpen(false);
    if (!confirm(`Apagar a coluna "${column.name}" e todos os cartões dela?`)) return;
    const { error } = await supabase.from("columns").delete().eq("id", column.id);
    if (error) onError(error.message);
    onChanged();
  }

  return (
    <section
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl ${
        column.team_only ? "bg-amber-50 ring-2 ring-amber-400" : "bg-slate-100"
      }`}
    >
      <header className="relative flex items-center gap-2 px-3 pt-2.5 pb-1">
        {column.team_only && (
          <span title="Só a equipe vê esta coluna" className="text-amber-600">
            <LockIcon />
          </span>
        )}
        <h2 className="flex-1 truncate text-sm font-semibold text-slate-800">{column.name}</h2>
        <span className="text-xs text-slate-500">{cardIds.length}</span>
        {permissions.isTeam && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded px-1.5 text-slate-500 hover:bg-black/5"
            aria-label="Opções da coluna"
          >
            ⋯
          </button>
        )}
        {menuOpen && (
          <div className="absolute top-9 right-2 z-20 w-56 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
            <button onClick={rename} className="block w-full px-3 py-1.5 text-left hover:bg-slate-100">
              Renomear
            </button>
            <button
              onClick={() => updateColumn({ team_only: !column.team_only })}
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
            >
              {column.team_only ? "Mostrar para o cliente" : "Deixar só para a equipe"}
            </button>
            <button onClick={remove} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50">
              Apagar coluna
            </button>
          </div>
        )}
      </header>
      {column.team_only && <p className="px-3 text-xs text-amber-700">Só a equipe vê esta coluna</p>}

      <div ref={setNodeRef} className="flex min-h-8 flex-col gap-2 overflow-y-auto px-2 py-2">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cardIds.map((id) => {
            const card = cardMap.get(id);
            return card ? (
              <SortableCard key={id} card={card} members={members} disabled={!canDrag} onOpen={() => onOpen(id)} />
            ) : null;
          })}
        </SortableContext>
      </div>

      {permissions.canEdit &&
        (adding ? (
          <form onSubmit={addCard} className="px-2 pb-2">
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) addCard(e);
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Título do cartão"
              className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm"
              rows={2}
            />
            <div className="mt-1 flex gap-2">
              <button className="rounded bg-teal-700 px-3 py-1 text-sm text-white">Adicionar</button>
              <button type="button" onClick={() => setAdding(false)} className="px-2 text-sm text-slate-500">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mx-2 mb-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-black/5"
          >
            + Adicionar cartão
          </button>
        ))}
    </section>
  );
}

function SortableCard({
  card,
  members,
  disabled,
  onOpen,
}: {
  card: CardSummary;
  members: Member[];
  disabled: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <CardTile card={card} members={members} />
    </div>
  );
}

function CardTile({ card, members, dragging }: { card: CardSummary; members: Member[]; dragging?: boolean }) {
  const overdue = card.due_date && card.due_date < new Date().toISOString().slice(0, 10);
  const allDone = card.checklist_total > 0 && card.checklist_done === card.checklist_total;
  return (
    <article
      className={`cursor-pointer rounded-lg bg-white p-2.5 text-sm shadow-sm ring-1 ring-black/5 hover:ring-teal-600 ${
        dragging ? "rotate-2 shadow-lg" : ""
      }`}
    >
      {card.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l} label={l} />
          ))}
        </div>
      )}
      <p className="text-slate-800">{card.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {card.due_date && (
          <span className={`rounded px-1.5 py-0.5 ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100"}`}>
            📅 {formatDate(card.due_date)}
          </span>
        )}
        {card.checklist_total > 0 && (
          <span className={`rounded px-1.5 py-0.5 ${allDone ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>
            ☑ {card.checklist_done}/{card.checklist_total}
          </span>
        )}
        {card.comment_count > 0 && <span>💬 {card.comment_count}</span>}
        {card.attachment_count > 0 && <span>📎 {card.attachment_count}</span>}
        <span className="ml-auto flex -space-x-1">
          {card.assignee_ids.map((id) => {
            const m = members.find((m) => m.user_id === id);
            return m ? <Avatar key={id} profile={m.profile} size="sm" /> : null;
          })}
        </span>
      </div>
    </article>
  );
}
