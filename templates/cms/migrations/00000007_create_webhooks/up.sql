create table webhooks (
  id integer primary key autoincrement,
  url text not null,
  events text not null default '[]',
  secret text not null,
  active integer not null default 1,
  created_at text default (datetime('now'))
);
