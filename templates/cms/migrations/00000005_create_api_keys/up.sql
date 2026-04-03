create table api_keys (
  id integer primary key autoincrement,
  name text not null,
  key text unique not null,
  permissions text not null default '[]',
  created_at text default (datetime('now')),
  last_used_at text
);

create unique index idx_api_keys_key on api_keys (key);
