create table users (
  id serial primary key,
  email text unique not null,
  name text not null,
  role text default 'user',
  created timestamp default now()
);

create index idx_users_email on users (email);
