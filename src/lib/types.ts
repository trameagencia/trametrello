export type MemberKind = "team" | "client";
export type Access = "edit" | "comment" | "view";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
};

export type Board = {
  id: string;
  name: string;
  client_name: string | null;
  color: string;
};

export type Column = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  team_only: boolean;
};

export type Card = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  due_date: string | null;
  labels: string[];
  archived_at: string | null;
  completed_at: string | null;
};

export type CardSummary = Card & {
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
  attachment_count: number;
  assignee_ids: string[];
};

export type ChecklistItem = {
  id: string;
  card_id: string;
  parent_id: string | null;
  title: string;
  done: boolean;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
};

export type Comment = {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
};

export type Attachment = {
  id: string;
  card_id: string;
  checklist_item_id: string | null;
  storage_path: string;
  name: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Member = {
  user_id: string;
  kind: MemberKind;
  access: Access;
  profile: Pick<Profile, "id" | "email" | "full_name">;
};

/** O que o usuário atual pode fazer neste quadro. */
export type Permissions = {
  isTeam: boolean;
  canEdit: boolean;
  canComment: boolean;
};

export function permissionsFor(isAdmin: boolean, member?: { kind: MemberKind; access: Access }): Permissions {
  if (isAdmin || member?.kind === "team") return { isTeam: true, canEdit: true, canComment: true };
  const access = member?.access ?? "view";
  return { isTeam: false, canEdit: access === "edit", canComment: access !== "view" };
}

export function displayName(p?: Pick<Profile, "email" | "full_name"> | null) {
  if (!p) return "Alguém";
  return p.full_name || p.email.split("@")[0];
}

/** Posição entre dois vizinhos, para reordenar sem renumerar tudo. */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}
