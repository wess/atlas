import type { Connection } from "@atlas/db";
import { from } from "@atlas/db";
import type { Conn } from "@atlas/server";
import { json } from "@atlas/server";
import type { ModelConfig } from "../config/index.ts";

export const handleBulkAction = async (
  db: Connection,
  table: string,
  modelCfg: ModelConfig,
  action: string,
  ids: (string | number)[],
  conn: Conn,
): Promise<Conn> => {
  const allowed = modelCfg.bulkActions ?? ["delete"];

  if (!allowed.includes(action as any)) {
    return json(conn, 400, { error: `Bulk action not allowed: ${action}` });
  }

  if (action === "delete") {
    return bulkDelete(db, table, ids, conn);
  }

  if (action === "export") {
    return bulkExport(db, table, ids, conn);
  }

  return json(conn, 400, { error: `Unknown bulk action: ${action}` });
};

const bulkDelete = async (db: Connection, table: string, ids: (string | number)[], conn: Conn): Promise<Conn> => {
  for (const id of ids) {
    await db.execute(
      from(table)
        .del()
        .where((q) => q("id").equals(id)),
    );
  }
  return json(conn, 200, { message: `Deleted ${ids.length} records` });
};

const bulkExport = async (db: Connection, table: string, ids: (string | number)[], conn: Conn): Promise<Conn> => {
  const rows = await db.all(from(table).where((q) => q("id").inList(ids)));
  return json(conn, 200, { data: rows, format: "export" });
};
