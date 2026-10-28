import Link from "next/link";
import type { Profile } from "@/lib/types";
import { displayName } from "@/lib/types";

export function TopBar({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-black/10 bg-slate-900 px-4 text-white">
      <Link href="/" className="font-semibold tracking-wide">
        TRAME
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3 text-sm">{children}</div>
      <span className="hidden text-sm text-slate-300 sm:inline">{displayName(profile)}</span>
      <form action="/auth/sair" method="post">
        <button className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-white/10 hover:text-white">Sair</button>
      </form>
    </header>
  );
}
