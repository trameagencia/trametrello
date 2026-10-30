import { NavLink, TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarEvent } from "@/components/CalendarView";
import { requireProfile } from "@/lib/supabase/server";
import type { Board } from "@/lib/types";

type CardRow = {
  id: string;
  title: string;
  board_id: string;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
};

type ItemRow = {
  id: string;
  title: string;
  due_date: string;
  done: boolean;
  card_id: string;
  cards: { title: string; board_id: string };
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  const { quadro } = await searchParams;
  const { supabase, profile } = await requireProfile();

  // As regras do banco já escondem do cliente os cartões das colunas só da equipe.
  const [{ data: boards }, { data: cards }, { data: items }] = await Promise.all([
    supabase.from("boards").select("*").order("name"),
    supabase
      .from("cards")
      .select("id, title, board_id, start_date, due_date, completed_at")
      .is("archived_at", null)
      .or("start_date.not.is.null,due_date.not.is.null"),
    supabase
      .from("checklist_items")
      .select("id, title, due_date, done, card_id, cards!inner(title, board_id, archived_at)")
      .not("due_date", "is", null)
      .is("cards.archived_at", null),
  ]);

  const events: CalendarEvent[] = [];
  for (const c of (cards ?? []) as CardRow[]) {
    const base = { cardId: c.id, boardId: c.board_id, title: c.title, done: !!c.completed_at };
    if (c.start_date) events.push({ ...base, id: `s-${c.id}`, date: c.start_date, kind: "start" });
    if (c.due_date) events.push({ ...base, id: `d-${c.id}`, date: c.due_date, kind: "due" });
  }
  for (const i of (items ?? []) as unknown as ItemRow[]) {
    events.push({
      id: `p-${i.id}`,
      date: i.due_date,
      kind: "piece",
      title: i.title,
      cardTitle: i.cards.title,
      cardId: i.card_id,
      boardId: i.cards.board_id,
      done: i.done,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar profile={profile}>
        <NavLink href="/">Quadros</NavLink>
        <NavLink href="/calendario">Calendário</NavLink>
      </TopBar>
      <CalendarView
        boards={(boards ?? []) as Board[]}
        events={events}
        initialBoardId={typeof quadro === "string" ? quadro : null}
      />
    </div>
  );
}
