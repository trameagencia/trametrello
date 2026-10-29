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
import { ArchivedPanel } from "./ArchivedPanel";
import { Avatar, CheckCircle, LabelChip, LockIcon, buttonSecondary, formatDate } from "./ui";

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
  const [openCard, setOpenCard] = useState<{ id: string; archived?: CardSummary } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
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

  async function toggleComplete(card: CardSummary, done: boolean) {
    setCardMap((prev) => new Map(prev).set(card.id, { ...card, completed_at: done ? new Date().toISOString() : null }));
    const { error } = await supabase.rpc("set_card_completed", { p_card: card.id, p_done: done });
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

  const modalCard = openCard ? (openCard.archived ?? cardMap.get(openCard.id)) : undefined;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{board.name}</h1>
          {board.client_name && <span className="hidden truncate text-[15px] text-ink-2 sm:inline">{board.client_name}</span>}
        </div>
        {permissions.isTeam && (
          <div className="flex rounded-full bg-black/[0.05] p-0.5 text-sm" role="tablist" aria-label="Modo de visualização">
            {[
              { label: "Equipe", value: false },
              { label: "Ver como cliente", value: true },
            ].map((opt) => (
              <button
                key={opt.label}
                role="tab"
                aria-selected={viewAsClient === opt.value}
                onClick={() => setViewAsClient(opt.value)}
                className={`rounded-full px-3 py-1 transition ${
                  viewAsClient === opt.value ? "bg-white font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setShowArchived(true)} className={`${buttonSecondary} py-1.5`}>
          Arquivados
        </button>
      </div>

      {(viewAsClient || error) && (
        <div className="flex items-center gap-3 px-4 pb-2 text-sm sm:px-6">
          {viewAsClient && <span className="text-ink-2">As colunas só da equipe estão escondidas, como o cliente vê.</span>}
          {error && (
            <button onClick={() => setError(null)} className="ml-auto rounded-full bg-[#ff3b30] px-3 py-1 text-white">
              {error} ×
            </button>
          )}
        </div>
      )}

      <DndContext
        id={`dnd-${board.id}`}
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
        <div className="scroll-soft flex flex-1 items-start gap-4 overflow-x-auto px-4 pb-6 sm:px-6">
          {visibleColumns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              cardIds={layout[column.id] ?? []}
              cardMap={cardMap}
              members={members}
              permissions={permissions}
              canDrag={canDrag}
              onOpen={(id) => setOpenCard({ id })}
              onToggleComplete={toggleComplete}
              onChanged={refresh}
              onError={setError}
            />
          ))}
          {permissions.isTeam && !viewAsClient && (
            <button
              onClick={addColumn}
              className="w-[280px] shrink-0 rounded-2xl border border-dashed border-black/15 px-4 py-3 text-left text-sm font-medium text-ink-2 transition hover:border-black/25 hover:bg-white/60 hover:text-ink"
            >
              + Adicionar coluna
            </button>
          )}
        </div>
        <DragOverlay>
          {draggingId && cardMap.get(draggingId) ? (
            <CardTile card={cardMap.get(draggingId)!} members={members} dragging canComplete={false} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {showArchived && (
        <ArchivedPanel
          boardId={board.id}
          permissions={permissions}
          onClose={() => setShowArchived(false)}
          onOpen={(card) => setOpenCard({ id: card.id, archived: card })}
          onChanged={refresh}
        />
      )}

      {modalCard && (
        <CardModal
          card={modalCard}
          columns={columns.filter((c) => permissions.isTeam || !c.team_only)}
          members={members}
          permissions={permissions}
          currentUserId={currentUserId}
          onClose={() => setOpenCard(null)}
          onChanged={() => {
            refresh();
            if (openCard?.archived) setOpenCard(null);
          }}
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
  onToggleComplete,
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
  onToggleComplete: (card: CardSummary, done: boolean) => void;
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
      className={`flex max-h-full w-[280px] shrink-0 flex-col rounded-2xl ${
        column.team_only ? "bg-[#fff6cc]/80 ring-1 ring-[#e6c200]/40" : "bg-[#ebebf0]/80"
      }`}
    >
      <header className="relative flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <h2 className="flex-1 truncate text-[15px] font-semibold text-ink">{column.name}</h2>
        <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs font-medium text-ink-2 tabular-nums">{cardIds.length}</span>
        {permissions.isTeam && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full px-2 py-0.5 text-ink-2 transition hover:bg-black/5 hover:text-ink"
            aria-label="Opções da coluna"
          >
            •••
          </button>
        )}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-10 right-2 z-20 w-60 overflow-hidden rounded-xl border border-line bg-white/95 py-1 text-sm shadow-xl backdrop-blur">
              <button onClick={rename} className="block w-full px-3.5 py-2 text-left hover:bg-black/[0.04]">
                Renomear
              </button>
              <button
                onClick={() => updateColumn({ team_only: !column.team_only })}
                className="block w-full px-3.5 py-2 text-left hover:bg-black/[0.04]"
              >
                {column.team_only ? "Mostrar para o cliente" : "Deixar só para a equipe"}
              </button>
              <div className="my-1 h-px bg-line" />
              <button onClick={remove} className="block w-full px-3.5 py-2 text-left text-[#d70015] hover:bg-[#ff3b30]/5">
                Apagar coluna
              </button>
            </div>
          </>
        )}
      </header>
      {column.team_only && (
        <p className="mx-3.5 mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#8a6d00]">
          <LockIcon /> Só a equipe vê esta coluna
        </p>
      )}

      <div ref={setNodeRef} className="scroll-soft flex min-h-10 flex-col gap-2 overflow-y-auto px-2 pt-1 pb-2">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cardIds.map((id) => {
            const card = cardMap.get(id);
            return card ? (
              <SortableCard
                key={id}
                card={card}
                members={members}
                disabled={!canDrag}
                canComplete={permissions.canComment}
                onOpen={() => onOpen(id)}
                onToggleComplete={(done) => onToggleComplete(card, done)}
              />
            ) : null;
          })}
        </SortableContext>
      </div>

      {permissions.canEdit &&
        (adding ? (
          <form onSubmit={addCard} className="px-2 pb-2.5">
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) addCard(e);
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Título do cartão"
              className="w-full resize-none rounded-xl border-0 bg-white p-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none focus:ring-4 focus:ring-accent/15"
              rows={2}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-white">Adicionar</button>
              <button type="button" onClick={() => setAdding(false)} className="px-2 text-sm text-ink-2 hover:text-ink">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mx-2 mb-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-ink-2 transition hover:bg-black/[0.05] hover:text-ink"
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
  canComplete,
  onOpen,
  onToggleComplete,
}: {
  card: CardSummary;
  members: Member[];
  disabled: boolean;
  canComplete: boolean;
  onOpen: () => void;
  onToggleComplete: (done: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <CardTile card={card} members={members} canComplete={canComplete} onToggleComplete={onToggleComplete} />
    </div>
  );
}

function CardTile({
  card,
  members,
  dragging,
  canComplete,
  onToggleComplete,
}: {
  card: CardSummary;
  members: Member[];
  dragging?: boolean;
  canComplete: boolean;
  onToggleComplete?: (done: boolean) => void;
}) {
  const completed = !!card.completed_at;
  const overdue = !completed && card.due_date && card.due_date < new Date().toISOString().slice(0, 10);
  const allDone = card.checklist_total > 0 && card.checklist_done === card.checklist_total;
  return (
    <article
      className={`group cursor-pointer rounded-xl bg-white p-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.05)] transition hover:shadow-[0_4px_14px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.06)] ${
        dragging ? "rotate-[1.5deg] shadow-[0_12px_32px_rgba(0,0,0,0.18)]" : ""
      }`}
    >
      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <LabelChip key={l} label={l} />
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <span
          className={`mt-px transition-all ${
            completed || !canComplete ? "" : "w-0 overflow-hidden opacity-0 group-hover:w-5 group-hover:opacity-100"
          } ${!completed && !canComplete ? "hidden" : ""}`}
        >
          <CheckCircle
            size="sm"
            checked={completed}
            disabled={!canComplete}
            onChange={onToggleComplete}
            label={completed ? "Marcar como não concluído" : "Marcar como concluído"}
          />
        </span>
        <p className={`min-w-0 flex-1 leading-snug ${completed ? "text-ink-2" : "text-ink"}`}>{card.title}</p>
      </div>
      {(card.due_date || card.checklist_total > 0 || card.comment_count > 0 || card.attachment_count > 0 || card.assignee_ids.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          {card.due_date && (
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                completed ? "bg-[#34c759]/15 text-[#1a7f37]" : overdue ? "bg-[#ff3b30]/12 text-[#d70015]" : "bg-black/[0.05]"
              }`}
            >
              {formatDate(card.due_date)}
            </span>
          )}
          {card.checklist_total > 0 && (
            <span className={`rounded-full px-2 py-0.5 font-medium tabular-nums ${allDone ? "bg-[#34c759]/15 text-[#1a7f37]" : "bg-black/[0.05]"}`}>
              ✓ {card.checklist_done}/{card.checklist_total}
            </span>
          )}
          {card.comment_count > 0 && <span className="px-1">💬 {card.comment_count}</span>}
          {card.attachment_count > 0 && <span className="px-1">📎 {card.attachment_count}</span>}
          <span className="ml-auto flex -space-x-1.5">
            {card.assignee_ids.map((id) => {
              const m = members.find((m) => m.user_id === id);
              return m ? <Avatar key={id} profile={m.profile} size="sm" /> : null;
            })}
          </span>
        </div>
      )}
    </article>
  );
}
