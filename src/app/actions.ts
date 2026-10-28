"use server";

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
