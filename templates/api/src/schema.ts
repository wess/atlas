export const users = {
  table: "users",
  columns: {
    id: "serial primary key",
    email: "text unique not null",
    name: "text not null",
    passwordHash: "text not null",
    created: "timestamp default now()",
    updated: "timestamp default now()",
  },
}
