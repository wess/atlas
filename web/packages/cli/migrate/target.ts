export type Target = { driver: "postgres"; url: string } | { driver: "sqlite"; path: string };

const sqlitePrefix = /^(sqlite:(\/\/)?|file:(\/\/)?)/;

// postgres:// and postgresql:// go to the postgres driver, anything else is a sqlite path
export const parseTarget = (value: string | undefined): Target => {
  const raw = value?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not set. Use postgres://user:pass@host/db or a sqlite path such as ./app.db");
  }
  if (/^postgres(ql)?:\/\//.test(raw)) return { driver: "postgres", url: raw };
  const path = raw.replace(sqlitePrefix, "");
  if (!path) throw new Error(`DATABASE_URL "${raw}" has no sqlite path`);
  return { driver: "sqlite", path };
};

const nameRule = /^[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/;

export const checkName = (name: string | undefined): string => {
  if (!name) throw new Error("Usage: atlas migrate new <name>  (e.g. atlas migrate new add_users)");
  if (!nameRule.test(name)) {
    throw new Error(`Invalid migration name "${name}". Use letters, digits and single underscores.`);
  }
  return name;
};
