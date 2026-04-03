create table users (
  id integer primary key autoincrement,
  email text unique not null,
  name text not null,
  role text not null default 'editor',
  password_hash text not null,
  created_at text default (datetime('now'))
);

create unique index idx_users_email on users (email);
