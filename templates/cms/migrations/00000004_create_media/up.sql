create table media (
  id integer primary key autoincrement,
  filename text not null,
  key text not null,
  url text not null,
  content_type text not null,
  size integer not null default 0,
  alt text,
  uploaded_by integer not null references users(id),
  created_at text default (datetime('now'))
);

create index idx_media_uploaded_by on media (uploaded_by);
create index idx_media_content_type on media (content_type);
