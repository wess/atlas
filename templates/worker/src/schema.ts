export const jobs = {
  table: "jobs",
  columns: {
    id: "uuid primary key",
    type: "text not null",
    payload: "jsonb",
    status: "text default 'pending'",
    result: "jsonb",
    error: "text",
    created: "timestamp default now()",
    completed: "timestamp",
  },
}
