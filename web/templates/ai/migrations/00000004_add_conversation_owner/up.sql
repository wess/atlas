-- conversations belong to the account that started them
alter table conversations add column user_id integer;
