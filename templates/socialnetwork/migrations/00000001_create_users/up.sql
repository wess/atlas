create table users (
  id integer primary key autoincrement,
  email text unique not null,
  username text unique not null,
  name text not null,
  bio text,
  avatar_url text,
  password_hash text not null,
  created_at text default (datetime('now'))
);

create unique index idx_users_email on users (email);
create unique index idx_users_username on users (username);
