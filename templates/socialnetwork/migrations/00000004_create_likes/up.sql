create table likes (
  id integer primary key autoincrement,
  user_id integer not null references users(id),
  post_id integer not null references posts(id),
  created_at text default (datetime('now'))
);

create unique index idx_likes_user_post on likes (user_id, post_id);
