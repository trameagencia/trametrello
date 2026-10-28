import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import type { Board } from "@/lib/types";
import { createBoard } from "./actions";

export default async function Home() {
  const { supabase, profile } = await requireProfile();
  const { data: boards } = await supabase.from("boards").select("*").order("name").returns<Board[]>();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Quadros</h1>
        {boards && boards.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id} className="relative">
                {profile.is_admin && (
                  <Link
                    href={`/b/${b.id}/membros`}
                    title="Editar ou excluir quadro"
                    className="absolute top-2 right-2 rounded px-2 py-0.5 text-sm text-white/80 hover:bg-black/20 hover:text-white"
                  >
                    ⚙
                  </Link>
                )}
                <Link
                  href={`/b/${b.id}`}
                  className="block h-24 rounded-lg p-4 text-white shadow-sm transition hover:brightness-110"
                  style={{ backgroundColor: b.color }}
                >
                  <div className="font-semibold">{b.name}</div>
                  {b.client_name && <div className="text-sm opacity-80">{b.client_name}</div>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {profile.is_admin
              ? "Nenhum quadro ainda. Crie o primeiro abaixo."
              : "Você ainda não foi adicionado a nenhum quadro. Peça acesso à equipe TRAME."}
          </p>
        )}

        {profile.is_admin && (
          <form action={createBoard} className="mt-8 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
            <input
              name="name"
              required
              placeholder="Nome do quadro (ex.: Padaria Pão Bom – Social)"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="client_name"
              placeholder="Cliente"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-48"
            />
            <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Criar quadro
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
