export const documents = {
  table: "documents",
  columns: {
    id: "integer primary key autoincrement",
    title: "text not null",
    content: "text not null",
    embeddingId: "text",
    createdAt: "datetime default current_timestamp",
  },
}

export const conversations = {
  table: "conversations",
  columns: {
    id: "integer primary key autoincrement",
    title: "text not null default 'New conversation'",
    messages: "text not null default '[]'",
    createdAt: "datetime default current_timestamp",
    updatedAt: "datetime default current_timestamp",
  },
}
