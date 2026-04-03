create table content_types (
  id integer primary key autoincrement,
  name text unique not null,
  display_name text not null,
  fields text not null default '[]',
  created_at text default (datetime('now')),
  updated_at text default (datetime('now'))
);

create unique index idx_content_types_name on content_types (name);
