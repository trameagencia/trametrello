import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/ui";
import { requireProfile } from "@/lib/supabase/server";
import { displayName, type Board, type Member } from "@/lib/types";
import { cancelInvite, removeMember, updateMember } from "./actions";
import { AccessSelect, InviteForm } from "./InviteForm";
import { BoardSettings } from "./BoardSettings";

const ACCESS_LABEL = { edit: "Pode editar", comment: "Comenta e move", view: "Só vê" } as const;

export default async function MembersPage({ params }: PageProps<"/b/[boardId]/membros">) {
  const { boardId } = await params;
  const { supabase, profile } = await requireProfile();
  const [{ data: board }, { data: members }, { data: invites }, { data: isTeam }] = await Promise.all([
    supabase.from("boards").select("*").eq("id", boardId).maybeSingle(),
    supabase.from("board_members").select("user_id, kind, access, profile:profiles(id, email, full_name)").eq("board_id", boardId),
    supabase.from("board_invites").select("email, kind, access").eq("board_id", boardId).order("created_at"),
    supabase.rpc("is_team", { p_board: boardId }),
  ]);
  if (!board || !isTeam) notFound();
  const b = board as Board;
  const list = (members ?? []) as unknown as Member[];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar profile={profile}>
        <Link href={`/b/${b.id}`} className="truncate font-medium hover:underline">
          ← {b.name}
        </Link>
      </TopBar>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <BoardSettings board={b} canDelete={profile.is_admin} />

        <div>
          <h1 className="text-xl font-semibold text-slate-900">Membros do quadro</h1>
          <p className="mt-1 text-sm text-slate-500">
            A equipe vê tudo, inclusive as colunas só da equipe. Clientes veem todo o resto do quadro.
          </p>
        </div>

        <InviteForm boardId={b.id} />

        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {list.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar profile={m.profile} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                  {displayName(m.profile)} {m.user_id === profile.id && <span className="text-slate-400">(você)</span>}
                </div>
                <div className="truncate text-xs text-slate-500">{m.profile.email}</div>
              </div>
              <form action={updateMember.bind(null, b.id, m.user_id)} className="flex items-center gap-2">
                <select name="kind" defaultValue={m.kind} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                  <option value="client">Cliente</option>
                  <option value="team">Equipe TRAME</option>
                </select>
                <AccessSelect defaultValue={m.access} />
                <button className="rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300">Salvar</button>
              </form>
              {m.user_id !== profile.id && (
                <form action={removeMember.bind(null, b.id, m.user_id)}>
                  <button className="text-sm text-red-600 hover:underline">Remover</button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {invites && invites.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Convites pendentes</h2>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {invites.map((i) => (
                <li key={i.email} className="flex items-center gap-3 p-3 text-sm">
                  <span className="flex-1 truncate">{i.email}</span>
                  <span className="text-slate-500">
                    {i.kind === "team" ? "Equipe" : `Cliente · ${ACCESS_LABEL[i.access as keyof typeof ACCESS_LABEL]}`}
                  </span>
                  <form action={cancelInvite.bind(null, b.id, i.email)}>
                    <button className="text-red-600 hover:underline">Cancelar</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
