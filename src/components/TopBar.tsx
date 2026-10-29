import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { displayName } from "@/lib/types";
import { Avatar } from "./ui";

export function TopBar({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-5 bg-trame px-4 text-ink sm:px-6">
      <Link href="/" aria-label="TRAME – início" className="shrink-0">
        <Image src="/trame-logo.png" alt="TRAME" width={308} height={67} priority className="h-6 w-auto" />
      </Link>
      <nav className="flex min-w-0 flex-1 items-center gap-1 text-[15px]">{children}</nav>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-ink/70 sm:inline">{displayName(profile)}</span>
        <Avatar profile={profile} />
        <form action="/auth/sair" method="post">
          <button className="rounded-full px-3 py-1.5 text-sm text-ink/70 transition hover:bg-black/5 hover:text-ink">Sair</button>
        </form>
      </div>
    </header>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="truncate rounded-full px-3 py-1.5 text-ink/75 transition hover:bg-black/5 hover:text-ink">
      {children}
    </Link>
  );
}
