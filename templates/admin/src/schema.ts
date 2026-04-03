export const users = {
  table: "users",
  columns: {
    id: "serial primary key",
    email: "text unique not null",
    name: "text not null",
    role: "text default 'user'",
    created: "timestamp default now()",
  },
}

export const posts = {
  table: "posts",
  columns: {
    id: "serial primary key",
    title: "text not null",
    body: "text not null",
    authorId: "integer references users(id)",
    published: "boolean default false",
    created: "timestamp default now()",
    updated: "timestamp default now()",
  },
}
