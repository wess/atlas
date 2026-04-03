create table entries (
  id integer primary key autoincrement,
  content_type_id integer not null references content_types(id),
  slug text not null,
  data text not null default '{}',
  status text not null default 'draft',
  author_id integer not null references users(id),
  published_at text,
  created_at text default (datetime('now')),
  updated_at text default (datetime('now'))
);

create unique index idx_entries_type_slug on entries (content_type_id, slug);
create index idx_entries_content_type_id on entries (content_type_id);
create index idx_entries_status on entries (status);
create index idx_entries_author_id on entries (author_id);
create index idx_entries_published_at on entries (published_at);
