-- Data de criação/produção do cartão (o prazo final do cliente continua em due_date).
alter table public.cards add column if not exists start_date date;
create index if not exists cards_start_date_idx on public.cards (start_date) where start_date is not null;
create index if not exists cards_due_date_idx on public.cards (due_date) where due_date is not null;
