import "server-only";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { permissionsFor, type Board, type CardSummary, type Column, type Member } from "@/lib/types";

type CardRow = Omit<CardSummary, "checklist_total" | "checklist_done" | "comment_count" | "attachment_count" | "assignee_ids"> & {
  checklist_items: { done: boolean }[];
  comments: { count: number }[];
  attachments: { count: number }[];
  card_assignees: { user_id: string }[];
};

export async function loadBoard(boardId: string) {
  const { supabase, profile } = await requireProfile();

  const [{ data: board }, { data: columns }, { data: cardRows }, { data: members }] = await Promise.all([
    supabase.from("boards").select("*").eq("id", boardId).maybeSingle(),
    supabase.from("columns").select("*").eq("board_id", boardId).order("position"),
    supabase
      .from("cards")
      .select("*, checklist_items(done), comments(count), attachments(count), card_assignees(user_id)")
      .eq("board_id", boardId)
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("board_members")
      .select("user_id, kind, access, profile:profiles(id, email, full_name)")
      .eq("board_id", boardId),
  ]);
  if (!board) notFound();

  const memberList = (members ?? []) as unknown as Member[];
  const me = memberList.find((m) => m.user_id === profile.id);
  const cards: CardSummary[] = ((cardRows ?? []) as CardRow[]).map(
    ({ checklist_items, comments, attachments, card_assignees, ...card }) => ({
      ...card,
      checklist_total: checklist_items.length,
      checklist_done: checklist_items.filter((i) => i.done).length,
      comment_count: comments[0]?.count ?? 0,
      attachment_count: attachments[0]?.count ?? 0,
      assignee_ids: card_assignees.map((a) => a.user_id),
    }),
  );

  return {
    profile,
    board: board as Board,
    columns: (columns ?? []) as Column[],
    cards,
    members: memberList,
    permissions: permissionsFor(profile.is_admin, me),
  };
}
