create table follows (
  id integer primary key autoincrement,
  follower_id integer not null references users(id),
  following_id integer not null references users(id),
  created_at text default (datetime('now'))
);

create unique index idx_follows_pair on follows (follower_id, following_id);
