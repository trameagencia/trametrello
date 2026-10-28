-- TRAME: quadros estilo Trello com colunas só da equipe e checklist de peças.
-- Todas as regras de acesso ficam aqui, no banco (Row Level Security), e não só na tela.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  -- Dono/admin da agência: vê e gerencia todos os quadros.
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  color text not null default '#0f766e',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- kind: 'team' = equipe TRAME (vê colunas só da equipe); 'client' = cliente.
-- access: o que um cliente pode fazer. Equipe sempre edita.
create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('team', 'client')),
  access text not null default 'comment' check (access in ('edit', 'comment', 'view')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- Convites para e-mails que ainda não têm conta; viram membros no primeiro login.
create table public.board_invites (
  board_id uuid not null references public.boards (id) on delete cascade,
  email text not null,
  kind text not null check (kind in ('team', 'client')),
  access text not null default 'comment' check (access in ('edit', 'comment', 'view')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, email)
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  position double precision not null default 0,
  -- Coluna invisível para clientes.
  team_only boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  column_id uuid not null references public.columns (id) on delete cascade,
  title text not null,
  description text not null default '',
  position double precision not null default 0,
  due_date date,
  labels text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_assignees (
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (card_id, user_id)
);

-- Checklist de peças a entregar. Visível para todos que veem o cartão.
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  -- Opcional: anexo da peça pronta de um item do checklist.
  checklist_item_id uuid references public.checklist_items (id) on delete set null,
  storage_path text not null unique,
  name text not null,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.board_members (user_id);
create index on public.columns (board_id, position);
create index on public.cards (column_id, position);
create index on public.cards (board_id);
create index on public.checklist_items (card_id, position);
create index on public.comments (card_id, created_at);
create index on public.attachments (card_id);

-- ---------------------------------------------------------------------------
-- Funções de permissão (security definer para não recursar nas políticas)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.member_kind(p_board uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'team'
    else (select kind from board_members where board_id = p_board and user_id = auth.uid())
  end;
$$;

create or replace function public.member_access(p_board uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'edit'
    else (
      select case when kind = 'team' then 'edit' else access end
      from board_members where board_id = p_board and user_id = auth.uid()
    )
  end;
$$;

create or replace function public.can_view_board(p_board uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_kind(p_board) is not null;
$$;

create or replace function public.is_team(p_board uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_kind(p_board) = 'team';
$$;

create or replace function public.can_edit_board(p_board uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_access(p_board) = 'edit';
$$;

create or replace function public.can_comment_board(p_board uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_access(p_board) in ('edit', 'comment');
$$;

create or replace function public.can_view_column(p_column uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from columns c
    where c.id = p_column
      and public.can_view_board(c.board_id)
      and (not c.team_only or public.is_team(c.board_id))
  );
$$;

create or replace function public.can_view_card(p_card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cards k where k.id = p_card and public.can_view_column(k.column_id)
  );
$$;

create or replace function public.card_board(p_card uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select board_id from cards where id = p_card;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_invites enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignees enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

-- Perfis: cada um vê o próprio e os de quem divide um quadro com ele.
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from board_members a join board_members b on a.board_id = b.board_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = public.is_admin());
create policy profiles_update_admin on public.profiles for update using (public.is_admin());

-- Quadros
create policy boards_select on public.boards for select using (public.can_view_board(id));
create policy boards_insert on public.boards for insert with check (public.is_admin());
create policy boards_update on public.boards for update using (public.is_team(id));
create policy boards_delete on public.boards for delete using (public.is_admin());

-- Membros: todos do quadro veem a lista; só a equipe gerencia.
create policy members_select on public.board_members for select using (public.can_view_board(board_id));
create policy members_write on public.board_members for all
  using (public.is_team(board_id)) with check (public.is_team(board_id));

create policy invites_all on public.board_invites for all
  using (public.is_team(board_id)) with check (public.is_team(board_id));

-- Colunas: coluna só da equipe nem aparece para o cliente.
create policy columns_select on public.columns for select using (
  public.can_view_board(board_id) and (not team_only or public.is_team(board_id))
);
create policy columns_write on public.columns for all
  using (public.is_team(board_id)) with check (public.is_team(board_id));

-- Cartões: seguem a visibilidade da coluna em que estão.
create policy cards_select on public.cards for select using (public.can_view_column(column_id));
create policy cards_insert on public.cards for insert with check (
  public.can_edit_board(board_id) and public.can_view_column(column_id)
  and board_id = (select c.board_id from columns c where c.id = column_id)
);
create policy cards_update on public.cards for update
  using (public.can_edit_board(board_id) and public.can_view_column(column_id))
  with check (
    public.can_edit_board(board_id) and public.can_view_column(column_id)
    and board_id = (select c.board_id from columns c where c.id = column_id)
  );
create policy cards_delete on public.cards for delete
  using (public.is_team(board_id) or (public.can_edit_board(board_id) and public.can_view_column(column_id)));

create policy assignees_select on public.card_assignees for select using (public.can_view_card(card_id));
create policy assignees_write on public.card_assignees for all
  using (public.can_view_card(card_id) and public.can_edit_board(public.card_board(card_id)))
  with check (public.can_view_card(card_id) and public.can_edit_board(public.card_board(card_id)));

-- Checklist: quem edita cria/apaga; quem comenta só marca e desmarca (via toggle_checklist_item).
create policy checklist_select on public.checklist_items for select using (public.can_view_card(card_id));
create policy checklist_write on public.checklist_items for all
  using (public.can_view_card(card_id) and public.can_edit_board(public.card_board(card_id)))
  with check (public.can_view_card(card_id) and public.can_edit_board(public.card_board(card_id)));

create policy comments_select on public.comments for select using (public.can_view_card(card_id));
create policy comments_insert on public.comments for insert with check (
  author_id = auth.uid() and public.can_view_card(card_id)
  and public.can_comment_board(public.card_board(card_id))
);
create policy comments_update_own on public.comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid() or public.is_team(public.card_board(card_id)));

create policy attachments_select on public.attachments for select using (public.can_view_card(card_id));
create policy attachments_insert on public.attachments for insert with check (
  uploaded_by = auth.uid() and public.can_view_card(card_id)
  and public.can_comment_board(public.card_board(card_id))
);
create policy attachments_delete on public.attachments for delete
  using (uploaded_by = auth.uid() or public.is_team(public.card_board(card_id)));

-- ---------------------------------------------------------------------------
-- Ações com regra própria
-- ---------------------------------------------------------------------------

-- Mover cartão: equipe e clientes que editam ou comentam podem arrastar,
-- mas só entre colunas que enxergam.
create or replace function public.move_card(p_card uuid, p_column uuid, p_position double precision)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_board uuid;
begin
  select board_id into v_board from cards where id = p_card;
  if v_board is null or not public.can_view_card(p_card) then
    raise exception 'Cartão não encontrado';
  end if;
  if not public.can_comment_board(v_board) then
    raise exception 'Sem permissão para mover cartões';
  end if;
  if not exists (select 1 from columns where id = p_column and board_id = v_board)
     or not public.can_view_column(p_column) then
    raise exception 'Coluna inválida';
  end if;
  update cards set column_id = p_column, position = p_position, updated_at = now() where id = p_card;
end;
$$;

create or replace function public.toggle_checklist_item(p_item uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_card uuid;
begin
  select card_id into v_card from checklist_items where id = p_item;
  if v_card is null or not public.can_view_card(v_card)
     or not public.can_comment_board(public.card_board(v_card)) then
    raise exception 'Sem permissão';
  end if;
  update checklist_items set done = p_done where id = p_item;
end;
$$;

-- Convidar por e-mail: se a pessoa já tem conta vira membro na hora;
-- senão fica pendente até o primeiro login.
create or replace function public.invite_to_board(p_board uuid, p_email text, p_kind text, p_access text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_team(p_board) then
    raise exception 'Só a equipe pode convidar';
  end if;
  select id into v_user from profiles where lower(email) = v_email;
  if v_user is not null then
    insert into board_members (board_id, user_id, kind, access)
    values (p_board, v_user, p_kind, p_access)
    on conflict (board_id, user_id) do update set kind = excluded.kind, access = excluded.access;
    return 'member';
  end if;
  insert into board_invites (board_id, email, kind, access, invited_by)
  values (p_board, v_email, p_kind, p_access, auth.uid())
  on conflict (board_id, email) do update set kind = excluded.kind, access = excluded.access;
  return 'invited';
end;
$$;

-- Quem cria um quadro entra como equipe nele.
create or replace function public.on_board_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into board_members (board_id, user_id, kind, access)
    values (new.id, auth.uid(), 'team', 'edit') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger board_created after insert on public.boards
  for each row execute function public.on_board_created();

-- Novo usuário: cria o perfil, converte convites pendentes.
-- A primeira pessoa a entrar no sistema vira admin (o dono da agência).
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, is_admin)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    not exists (select 1 from profiles)
  );
  insert into board_members (board_id, user_id, kind, access)
  select board_id, new.id, kind, access from board_invites where email = lower(new.email)
  on conflict do nothing;
  delete from board_invites where email = lower(new.email);
  return new;
end;
$$;
create trigger auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Anexos (Storage). Caminho: <board_id>/<card_id>/<arquivo>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_read on storage.objects for select using (
  bucket_id = 'attachments' and public.can_view_card(((storage.foldername(name))[2])::uuid)
);
create policy attachments_upload on storage.objects for insert with check (
  bucket_id = 'attachments'
  and public.can_view_card(((storage.foldername(name))[2])::uuid)
  and public.can_comment_board(((storage.foldername(name))[1])::uuid)
  and public.card_board(((storage.foldername(name))[2])::uuid) = ((storage.foldername(name))[1])::uuid
);
create policy attachments_remove on storage.objects for delete using (
  bucket_id = 'attachments'
  and (owner = auth.uid() or public.is_team(((storage.foldername(name))[1])::uuid))
);

-- ---------------------------------------------------------------------------
-- Tempo real: o quadro atualiza sozinho (respeitando as mesmas regras acima)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.columns, public.cards, public.checklist_items, public.comments, public.attachments, public.card_assignees;
