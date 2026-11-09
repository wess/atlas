import type { Connection } from "../../db/query.ts";
import { from } from "../../db/query.ts";
import type { Conn } from "../../server/index.ts";
import { json } from "../../server/index.ts";
import type { ModelConfig } from "../config/index.ts";

/** The ids from a request body, or null unless it is an array of strings and finite numbers. */
export const parseIds = (value: unknown): (string | number)[] | null =>
  Array.isArray(value) && value.every((id) => typeof id === "string" || (typeof id === "number" && Number.isFinite(id)))
    ? value
    : null;

export const handleBulkAction = async (
  db: Connection,
  table: string,
  modelCfg: ModelConfig,
  action: string,
  ids: (string | number)[],
  conn: Conn,
): Promise<Conn> => {
  const allowed = modelCfg.bulkActions ?? ["delete"];
  // a string would be iterated per character, deleting ids "1", "2", ...
  if (!parseIds(ids)) return json(conn, 400, { error: "ids must be an array of record ids" });

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
