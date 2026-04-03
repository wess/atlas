create table revisions (
  id integer primary key autoincrement,
  entry_id integer not null references entries(id),
  data text not null,
  author_id integer not null references users(id),
  created_at text default (datetime('now'))
);

create index idx_revisions_entry_id on revisions (entry_id);
create index idx_revisions_author_id on revisions (author_id);
