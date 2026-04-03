create table posts (
  id integer primary key autoincrement,
  user_id integer not null references users(id),
  content text not null,
  image_url text,
  created_at text default (datetime('now'))
);

create index idx_posts_user_id on posts (user_id);
create index idx_posts_created_at on posts (created_at);
