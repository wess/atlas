create table conversations (
  id integer primary key autoincrement,
  title text not null default 'New conversation',
  messages text not null default '[]',
  created_at datetime default current_timestamp,
  updated_at datetime default current_timestamp
);

create index idx_conversations_updated on conversations (updated_at);
