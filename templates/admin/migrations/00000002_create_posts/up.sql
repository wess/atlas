create table posts (
  id serial primary key,
  title text not null,
  body text not null,
  author_id integer references users(id),
  published boolean default false,
  created timestamp default now(),
  updated timestamp default now()
);

create index idx_posts_author on posts (author_id);
create index idx_posts_published on posts (published);
