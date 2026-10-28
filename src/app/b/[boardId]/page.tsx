import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BoardView } from "@/components/BoardView";
import { loadBoard } from "./data";

export default async function BoardPage({ params }: PageProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const { profile, board, columns, cards, members, permissions } = await loadBoard(boardId);

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: board.color }}>
      <TopBar profile={profile}>
        <span className="truncate font-medium">{board.name}</span>
        {board.client_name && <span className="hidden truncate text-slate-400 sm:inline">{board.client_name}</span>}
        {permissions.isTeam && (
          <Link href={`/b/${board.id}/membros`} className="rounded px-2 py-1 text-slate-300 hover:bg-white/10 hover:text-white">
            Membros
          </Link>
        )}
      </TopBar>
      <BoardView
        board={board}
        columns={columns}
        cards={cards}
        members={members}
        permissions={permissions}
        currentUserId={profile.id}
      />
    </div>
  );
}
