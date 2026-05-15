export type ColumnType = "serial" | "text" | "integer" | "boolean" | "timestamp" | "json" | "uuid" | "bigint" | "real";

// TS = the TypeScript type a column produces in a row.
// N = nullability flag (true → row value can be null).
export type ColumnDef<TS = unknown, N extends boolean = false> = {
  readonly type: ColumnType;
  readonly primary: boolean;
  readonly isUnique: boolean;
  readonly isNullable: N;
  readonly defaultValue: unknown;
  readonly references: { table: string; column: string } | null;
  readonly primaryKey: () => ColumnDef<TS, N>;
  readonly nullable: () => ColumnDef<TS, true>;
  readonly default: (value: TS) => ColumnDef<TS, N>;
  readonly unique: () => ColumnDef<TS, N>;
  readonly ref: (table: string, col: string) => ColumnDef<TS, N>;
  // Phantom marker so TS infers the column's row type at the type level.
  readonly __ts?: TS;
};

type ColumnState = {
  primary: boolean;
  isUnique: boolean;
  isNullable: boolean;
  defaultValue: unknown;
  references: { table: string; column: string } | null;
};

const baseState: ColumnState = {
  primary: false,
  isUnique: false,
  isNullable: false,
  defaultValue: undefined,
  references: null,
};

const buildColumn = <TS, N extends boolean>(type: ColumnType, state: ColumnState): ColumnDef<TS, N> => ({
  type,
  primary: state.primary,
  isUnique: state.isUnique,
  isNullable: state.isNullable as N,
  defaultValue: state.defaultValue,
  references: state.references,
  primaryKey: () => buildColumn<TS, N>(type, { ...state, primary: true }),
  nullable: () => buildColumn<TS, true>(type, { ...state, isNullable: true }),
  default: (value: TS) => buildColumn<TS, N>(type, { ...state, defaultValue: value }),
  unique: () => buildColumn<TS, N>(type, { ...state, isUnique: true }),
  ref: (table: string, col: string) => buildColumn<TS, N>(type, { ...state, references: { table, column: col } }),
});

const createColumn = <TS>(type: ColumnType): ColumnDef<TS, false> => buildColumn<TS, false>(type, baseState);

// Extract the TypeScript type a single ColumnDef produces in a row.
export type ColumnTs<C> = C extends ColumnDef<infer TS, infer N> ? (N extends true ? TS | null : TS) : never;

export const column = {
  serial: () => createColumn<number>("serial"),
  text: () => createColumn<string>("text"),
  integer: () => createColumn<number>("integer"),
  boolean: () => createColumn<boolean>("boolean"),
  timestamp: () => createColumn<Date>("timestamp"),
  json: <T = unknown>() => createColumn<T>("json"),
  uuid: () => createColumn<string>("uuid"),
  bigint: () => createColumn<bigint>("bigint"),
  real: () => createColumn<number>("real"),
} as const;
