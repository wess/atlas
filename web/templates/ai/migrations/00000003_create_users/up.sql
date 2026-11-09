create table users (
  id integer primary key autoincrement,
  email text not null unique,
  password_hash text not null,
  created_at datetime default current_timestamp
);
