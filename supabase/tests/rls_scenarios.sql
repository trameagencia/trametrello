\set ON_ERROR_STOP 0
grant all on all tables in schema public to authenticated;
grant all on all tables in schema storage to authenticated;
grant execute on all functions in schema public to authenticated;
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','marcelo@trame.com'),
 ('00000000-0000-0000-0000-000000000002','equipe@trame.com'),
 ('00000000-0000-0000-0000-000000000003','cliente@x.com'),
 ('00000000-0000-0000-0000-000000000005','fora@x.com');
select email, is_admin from profiles order by email;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into boards (id, name) values ('b0000000-0000-0000-0000-000000000001','Cliente X');
insert into columns (id, board_id, name, position, team_only) values
 ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','A fazer',1,false),
 ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','Interno',2,true);
insert into cards (id, board_id, column_id, title) values
 ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Post visível'),
 ('d0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','Post interno');
insert into checklist_items (id, card_id, title) values ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','Arte feed');
select invite_to_board('b0000000-0000-0000-0000-000000000001','equipe@trame.com','team','edit');
select invite_to_board('b0000000-0000-0000-0000-000000000001','cliente@x.com','client','comment');
select invite_to_board('b0000000-0000-0000-0000-000000000001','Novo@X.com','client','view');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000004','novo@x.com');
select user_id, kind, access from board_members order by user_id;
set role authenticated;
\echo '--- equipe'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select title from cards order by title;
\echo '--- cliente (comenta)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select name from columns order by position;
select title from cards order by title;
select count(*) as interno_por_id from cards where id='d0000000-0000-0000-0000-000000000002';
update cards set title='hack' where id='d0000000-0000-0000-0000-000000000001';
select title from cards;
select move_card('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',1);
select toggle_checklist_item('e0000000-0000-0000-0000-000000000001', true);
select title, done from checklist_items;
insert into comments (card_id, author_id, body) values ('d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','ok!');
insert into comments (card_id, author_id, body) values ('d0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','espiando');
select invite_to_board('b0000000-0000-0000-0000-000000000001','x@x.com','team','edit');
\echo '--- novo (só vê)'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select title from cards;
select toggle_checklist_item('e0000000-0000-0000-0000-000000000001', false);
insert into comments (card_id, author_id, body) values ('d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','oi');
\echo '--- fora'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select count(*) boards from boards; select count(*) cards from cards;
insert into boards (name) values ('x');
\echo '--- equipe move para interno'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select move_card('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) cliente_ve from cards;
\echo '--- storage'
insert into storage.objects (bucket_id, name, owner) values ('attachments','b0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000002/a.png','00000000-0000-0000-0000-000000000003');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into storage.objects (bucket_id, name, owner) values ('attachments','b0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000002/a.png','00000000-0000-0000-0000-000000000002');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) cliente_ve_arquivo from storage.objects;
update profiles set is_admin = true where id = '00000000-0000-0000-0000-000000000003';
\echo '--- 0002: concluir cartão'
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select set_card_completed('d0000000-0000-0000-0000-000000000001', true);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select set_card_completed('d0000000-0000-0000-0000-000000000001', true);
select title, completed_at is not null as concluido from cards order by title;
insert into checklist_items (card_id, title, parent_id) values ('d0000000-0000-0000-0000-000000000001','Sub-peça','e0000000-0000-0000-0000-000000000001');
update cards set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000002';
select title, archived_at is not null as arquivado from cards order by title;
