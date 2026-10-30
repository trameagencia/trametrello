import { NavLink, TopBar } from "@/components/TopBar";
import { BoardView } from "@/components/BoardView";
import { loadBoard } from "./data";

export default async function BoardPage({ params, searchParams }: PageProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const { card } = await searchParams;
  const { profile, board, columns, cards, members, permissions } = await loadBoard(boardId);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar profile={profile}>
        <NavLink href="/">Quadros</NavLink>
        <NavLink href="/calendario">Calendário</NavLink>
        {permissions.isTeam && <NavLink href={`/b/${board.id}/membros`}>Configurar quadro</NavLink>}
      </TopBar>
      <BoardView
        board={board}
        columns={columns}
        cards={cards}
        members={members}
        permissions={permissions}
        currentUserId={profile.id}
        initialCardId={typeof card === "string" ? card : null}
      />
    </div>
  );
}
