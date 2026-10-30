"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Board } from "@/lib/types";
import { buttonSecondary, formatDate } from "./ui";

export type CalendarEvent = {
  id: string;
  date: string;
  kind: "start" | "due" | "piece";
  title: string;
  cardTitle?: string;
  cardId: string;
  boardId: string;
  done: boolean;
};

type Filter = "all" | "start" | "due" | "piece";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "start", label: "Criação" },
  { value: "due", label: "Deadline" },
  { value: "piece", label: "Peças" },
];

const KIND_LABEL = { start: "Criação", due: "Deadline do cliente", piece: "Peça" } as const;
const KIND_ORDER = { due: 0, start: 1, piece: 2 } as const;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_PER_DAY = 3;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** As 6 semanas (domingo a sábado) que cobrem o mês. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Calendário geral: datas de criação, deadlines do cliente e prazos das peças de todos os quadros. */
export function CalendarView({ boards, events, initialBoardId }: { boards: Board[]; events: CalendarEvent[]; initialBoardId: string | null }) {
  const today = isoDay(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [boardId, setBoardId] = useState(initialBoardId && boards.some((b) => b.id === initialBoardId) ? initialBoardId : "");
  const [selected, setSelected] = useState(today);

  const boardMap = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (filter !== "all" && e.kind !== filter) continue;
      if (boardId && e.boardId !== boardId) continue;
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
    return map;
  }, [events, filter, boardId]);

  const days = monthGrid(cursor.year, cursor.month);
  const monthTitle = new Date(cursor.year, cursor.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedEvents = byDay.get(selected) ?? [];

  // Atrasados: deadlines e peças vencidas que ainda não foram concluídas.
  const overdue = useMemo(
    () => [...byDay.entries()].filter(([d]) => d < today).flatMap(([, list]) => list.filter((e) => e.kind !== "start" && !e.done)),
    [byDay, today],
  );

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(today);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row">
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-semibold tracking-tight text-ink first-letter:uppercase">{monthTitle}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-full p-2 text-ink-2 hover:bg-black/5" aria-label="Mês anterior">
              ‹
            </button>
            <button onClick={goToday} className={`${buttonSecondary} py-1.5`}>
              Hoje
            </button>
            <button onClick={() => shift(1)} className="rounded-full p-2 text-ink-2 hover:bg-black/5" aria-label="Próximo mês">
              ›
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full bg-black/[0.05] p-0.5 text-sm" role="tablist" aria-label="Tipo de data">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 transition ${
                  filter === f.value ? "bg-white font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="rounded-full bg-black/[0.05] px-3 py-1.5 text-sm text-ink outline-none focus:ring-4 focus:ring-accent/15"
            aria-label="Quadro"
          >
            <option value="">Todos os quadros</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Legend />
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-medium tracking-wide text-ink-3 uppercase">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const key = isoDay(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.month;
              const isToday = key === today;
              const isSelected = key === selected;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => e.key === "Enter" && setSelected(key)}
                  className={`min-h-[72px] cursor-pointer sm:min-h-[104px] border-line p-1.5 text-left transition ${i % 7 ? "border-l" : ""} ${
                    i >= 7 ? "border-t" : ""
                  } ${inMonth ? "bg-white" : "bg-canvas/60"} ${isSelected ? "ring-2 ring-accent ring-inset" : "hover:bg-black/[0.02]"}`}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                        isToday ? "bg-[#ff3b30] font-semibold text-white" : inMonth ? "text-ink" : "text-ink-3"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {list.slice(0, MAX_PER_DAY).map((e) => (
                      <li key={e.id}>
                        <EventPill event={e} color={boardMap.get(e.boardId)?.color ?? "#8e8e93"} overdue={key < today} />
                      </li>
                    ))}
                    {list.length > MAX_PER_DAY && (
                      <li className="px-1.5 text-[11px] font-medium text-ink-2">+{list.length - MAX_PER_DAY}<span className="hidden sm:inline"> mais</span></li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink first-letter:uppercase">
            {new Date(`${selected}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">Nada marcado neste dia.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} board={boardMap.get(e.boardId)} overdue={selected < today} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {overdue.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#d70015]">Atrasados ({overdue.length})</h2>
            <ul className="mt-3 space-y-2">
              {overdue.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <EventRow event={e} board={boardMap.get(e.boardId)} overdue showDate />
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </main>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink-3" /> Criação
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink-3" /> Deadline do cliente
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[11px]">✓</span> Peça
      </span>
    </div>
  );
}

function cardHref(e: CalendarEvent) {
  return `/b/${e.boardId}?card=${e.cardId}`;
}

/** Marcação compacta dentro da célula do dia. Criação = contorno, deadline = preenchido, peça = ✓. */
function EventPill({ event: e, color, overdue }: { event: CalendarEvent; color: string; overdue: boolean }) {
  const late = overdue && e.kind !== "start" && !e.done;
  const base = "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 min-h-2 text-[11px] leading-4 transition hover:brightness-95";
  const label = e.kind === "piece" ? `${e.title} · ${e.cardTitle}` : e.title;
  const title = `${KIND_LABEL[e.kind]}: ${label}`;
  if (e.kind === "due") {
    return (
      <Link
        href={cardHref(e)}
        onClick={(ev) => ev.stopPropagation()}
        title={title}
        style={{ backgroundColor: late ? "#ff3b30" : color }}
        className={`${base} font-medium text-white ${e.done ? "line-through opacity-60" : ""}`}
      >
        <span className="hidden truncate sm:inline">{e.title}</span>
      </Link>
    );
  }
  if (e.kind === "start") {
    return (
      <Link
        href={cardHref(e)}
        onClick={(ev) => ev.stopPropagation()}
        title={title}
        style={{ borderColor: color, color }}
        className={`${base} border-[1.5px] bg-white font-medium ${e.done ? "line-through opacity-60" : ""}`}
      >
        <span className="hidden truncate sm:inline">{e.title}</span>
      </Link>
    );
  }
  return (
    <Link
      href={cardHref(e)}
      onClick={(ev) => ev.stopPropagation()}
      title={title}
      className={`${base} ${late ? "text-[#d70015]" : "text-ink-2"} hover:bg-black/5 ${e.done ? "line-through opacity-60" : ""}`}
    >
      <span className="shrink-0" style={{ color: e.done ? "#34c759" : color }}>
        ✓
      </span>
      <span className="hidden truncate sm:inline">{label}</span>
    </Link>
  );
}

/** Linha detalhada no painel lateral. */
function EventRow({ event: e, board, overdue, showDate }: { event: CalendarEvent; board?: Board; overdue: boolean; showDate?: boolean }) {
  const late = overdue && e.kind !== "start" && !e.done;
  const color = board?.color ?? "#8e8e93";
  return (
    <Link href={cardHref(e)} className="flex gap-3 rounded-xl p-2 transition hover:bg-black/[0.04]">
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={e.kind === "start" ? { border: `1.5px solid ${color}` } : { backgroundColor: color }}
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium text-ink ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</span>
        <span className="block truncate text-xs text-ink-2">
          <span className={late ? "font-medium text-[#d70015]" : ""}>
            {KIND_LABEL[e.kind]}
            {showDate && ` · ${formatDate(e.date)}`}
            {e.done && " · concluído"}
          </span>
          {e.cardTitle && ` · ${e.cardTitle}`}
          {board && ` · ${board.name}`}
        </span>
      </span>
    </Link>
  );
}
