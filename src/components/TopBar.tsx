import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { displayName } from "@/lib/types";
import { Avatar } from "./ui";

export function TopBar({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-trame px-4 sm:gap-5 text-ink sm:px-6">
      <Link href="/" aria-label="TRAME – início" className="shrink-0">
        <Image src="/trame-logo.png" alt="TRAME" width={308} height={67} priority className="h-5 w-auto sm:h-6" />
      </Link>
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-sm sm:gap-1 sm:text-[15px]">{children}</nav>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden text-sm text-ink/70 sm:inline">{displayName(profile)}</span>
        <Avatar profile={profile} />
        <form action="/auth/sair" method="post">
          <button className="rounded-full px-2 py-1.5 text-sm text-ink/70 transition sm:px-3 hover:bg-black/5 hover:text-ink">Sair</button>
        </form>
      </div>
    </header>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="truncate rounded-full px-2 py-1.5 text-ink/75 sm:px-3 transition hover:bg-black/5 hover:text-ink">
      {children}
    </Link>
  );
}
