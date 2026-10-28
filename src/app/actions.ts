"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Colunas com que todo quadro novo começa; a de produção é só da equipe.
const DEFAULT_COLUMNS = [
  { name: "A fazer", team_only: false },
  { name: "Em produção (equipe)", team_only: true },
  { name: "Aprovação do cliente", team_only: false },
  { name: "Ajustes", team_only: false },
  { name: "Aprovado", team_only: false },
  { name: "Publicado", team_only: false },
];

export async function createBoard(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const { data: board, error } = await supabase
    .from("boards")
    .insert({ name, client_name: clientName || null })
    .select("id")
    .single();
  if (error || !board) throw new Error(error?.message ?? "Não foi possível criar o quadro");

  await supabase.from("columns").insert(
    DEFAULT_COLUMNS.map((c, i) => ({ ...c, board_id: board.id, position: (i + 1) * 1000 })),
  );
  redirect(`/b/${board.id}`);
}

export async function updateBoard(boardId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const color = String(formData.get("color") ?? "");
  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("boards")
    .update({ name, client_name: clientName || null, ...(/^#[0-9a-f]{6}$/i.test(color) ? { color } : {}) })
    .eq("id", boardId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteBoard(boardId: string) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Só o administrador pode excluir quadros.");
  // Apaga os arquivos do Storage antes; as linhas do banco somem em cascata com o quadro.
  const { data: files } = await supabase
    .from("attachments")
    .select("storage_path, cards!inner(board_id)")
    .eq("cards.board_id", boardId);
  const paths = (files ?? []).map((f) => f.storage_path as string);
  if (paths.length) await supabase.storage.from("attachments").remove(paths);

  const { error } = await supabase.from("boards").delete().eq("id", boardId).select("id").single();
  if (error) throw new Error("Só o administrador pode excluir quadros.");
  revalidatePath("/", "layout");
  redirect("/");
}
