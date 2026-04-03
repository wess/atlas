create table media (
  id integer primary key autoincrement,
  user_id integer not null references users(id),
  key text not null,
  url text not null,
  content_type text not null,
  created_at text default (datetime('now'))
);

create index idx_media_user_id on media (user_id);
