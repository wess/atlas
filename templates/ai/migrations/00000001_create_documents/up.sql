create table documents (
  id integer primary key autoincrement,
  title text not null,
  content text not null,
  embedding_id text,
  created_at datetime default current_timestamp
);

create index idx_documents_embedding on documents (embedding_id);
