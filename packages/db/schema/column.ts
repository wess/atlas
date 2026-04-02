export type ColumnType = "serial" | "text" | "integer" | "boolean" | "timestamp" | "json" | "uuid" | "bigint" | "real";

export type ColumnDef = {
  readonly type: ColumnType;
  readonly primary: boolean;
  readonly isUnique: boolean;
  readonly isNullable: boolean;
  readonly defaultValue: unknown;
  readonly references: { table: string; column: string } | null;
  readonly primaryKey: () => ColumnDef;
  readonly nullable: () => ColumnDef;
  readonly default: (value: unknown) => ColumnDef;
  readonly unique: () => ColumnDef;
  readonly ref: (table: string, col: string) => ColumnDef;
};

const createColumn = (type: ColumnType, overrides: Partial<ColumnDef> = {}): ColumnDef => {
  const def: ColumnDef = {
    type,
    primary: overrides.primary ?? false,
    isUnique: overrides.isUnique ?? false,
    isNullable: overrides.isNullable ?? false,
    defaultValue: overrides.defaultValue,
    references: overrides.references ?? null,
    primaryKey: () => createColumn(type, { ...overrides, primary: true }),
    nullable: () => createColumn(type, { ...overrides, isNullable: true }),
    default: (value: unknown) => createColumn(type, { ...overrides, defaultValue: value }),
    unique: () => createColumn(type, { ...overrides, isUnique: true }),
    ref: (table: string, col: string) => createColumn(type, { ...overrides, references: { table, column: col } }),
  };
  return def;
};

export const column = {
  serial: () => createColumn("serial"),
  text: () => createColumn("text"),
  integer: () => createColumn("integer"),
  boolean: () => createColumn("boolean"),
  timestamp: () => createColumn("timestamp"),
  json: () => createColumn("json"),
  uuid: () => createColumn("uuid"),
  bigint: () => createColumn("bigint"),
  real: () => createColumn("real"),
} as const;
