import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { buttonPrimary, inputBase } from "@/components/ui";
import type { Board } from "@/lib/types";
import { createBoard } from "./actions";

export default async function Home() {
  const { supabase, profile } = await requireProfile();
  const { data } = await supabase.from("boards").select("*").order("name");
  const boards = (data ?? []) as Board[];

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-[32px] font-semibold tracking-tight text-ink">Quadros</h1>
        <p className="mt-1 text-[15px] text-ink-2">Um quadro por cliente ou projeto.</p>

        {boards.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id} className="group relative">
                <Link
                  href={`/b/${b.id}`}
                  className="block overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.05)]"
                >
                  <div className="h-16" style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}cc)` }} />
                  <div className="px-4 py-3.5">
                    <div className="truncate text-[17px] font-semibold tracking-tight text-ink">{b.name}</div>
                    <div className="truncate text-sm text-ink-2">{b.client_name || " "}</div>
                  </div>
                </Link>
                {profile.is_admin && (
                  <Link
                    href={`/b/${b.id}/membros`}
                    title="Editar ou excluir quadro"
                    aria-label={`Configurar ${b.name}`}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink/70 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:text-ink focus:opacity-100"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                    </svg>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-2xl bg-white p-6 text-[15px] text-ink-2 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
            {profile.is_admin
              ? "Nenhum quadro ainda. Crie o primeiro abaixo."
              : "Você ainda não foi adicionado a nenhum quadro. Peça acesso à equipe TRAME."}
          </p>
        )}

        {profile.is_admin && (
          <form
            action={createBoard}
            className="mt-10 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]"
          >
            <h2 className="text-[17px] font-semibold tracking-tight">Novo quadro</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input name="name" required placeholder="Nome do quadro (ex.: Padaria Pão Bom – Social)" className={`${inputBase} flex-1`} />
              <input name="client_name" placeholder="Cliente" className={`${inputBase} sm:w-48`} />
              <button className={buttonPrimary}>Criar quadro</button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
