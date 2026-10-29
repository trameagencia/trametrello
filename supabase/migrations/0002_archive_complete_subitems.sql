-- Arquivar cartões, marcar cartão como concluído, sub-checklist e menções.
-- Só acrescenta colunas e funções: pode rodar com o sistema no ar.

alter table public.cards add column if not exists archived_at timestamptz;
alter table public.cards add column if not exists completed_at timestamptz;

-- Sub-itens do checklist: um item pode ter um item "pai" (um nível).
alter table public.checklist_items
  add column if not exists parent_id uuid references public.checklist_items (id) on delete cascade;
create index if not exists checklist_items_parent_idx on public.checklist_items (parent_id);

-- Quem foi mencionado (@) no comentário, para avisos no futuro.
alter table public.comments add column if not exists mentions uuid[] not null default '{}';

create index if not exists cards_board_archived_idx on public.cards (board_id, archived_at);

-- Concluir/reabrir cartão: equipe e clientes que editam ou comentam, como marcar uma peça.
create or replace function public.set_card_completed(p_card uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_card(p_card) or not public.can_comment_board(public.card_board(p_card)) then
    raise exception 'Sem permissão';
  end if;
  update cards set completed_at = case when p_done then now() else null end where id = p_card;
end;
$$;
