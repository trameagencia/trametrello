"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

export type InviteState = { message: string; ok: boolean } | null;

export async function inviteMember(boardId: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const kind = formData.get("kind") === "team" ? "team" : "client";
  const access = kind === "team" ? "edit" : String(formData.get("access") ?? "comment");
  if (!email) return { ok: false, message: "Informe um e-mail." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_to_board", {
    p_board: boardId,
    p_email: email,
    p_kind: kind,
    p_access: access,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/b/${boardId}/membros`);

  if (data === "member") return { ok: true, message: `${email} já tinha conta e foi adicionado ao quadro.` };

  // Sem conta ainda: com a chave de serviço configurada, o Supabase manda o convite por e-mail.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const admin = createAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
    });
    if (!inviteError) return { ok: true, message: `Convite enviado para ${email}.` };
  }
  return {
    ok: true,
    message: `${email} foi convidado. Mande o endereço do sistema para a pessoa entrar com esse e-mail; o quadro aparece no primeiro acesso.`,
  };
}

export async function updateMember(boardId: string, userId: string, formData: FormData) {
  const kind = formData.get("kind") === "team" ? "team" : "client";
  const access = kind === "team" ? "edit" : String(formData.get("access") ?? "comment");
  const supabase = await createClient();
  await supabase.from("board_members").update({ kind, access }).eq("board_id", boardId).eq("user_id", userId);
  revalidatePath(`/b/${boardId}/membros`);
}

export async function removeMember(boardId: string, userId: string) {
  const supabase = await createClient();
  await supabase.from("board_members").delete().eq("board_id", boardId).eq("user_id", userId);
  revalidatePath(`/b/${boardId}/membros`);
}

export async function cancelInvite(boardId: string, email: string) {
  const supabase = await createClient();
  await supabase.from("board_invites").delete().eq("board_id", boardId).eq("email", email);
  revalidatePath(`/b/${boardId}/membros`);
}
