export type Fragment = {
  readonly __brand: "fragment";
  readonly sql: string;
  readonly values: readonly any[];
};

export type Column = string | Fragment;

export type ComparisonOp =
  | "="
  | "!="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "LIKE"
  | "ILIKE"
  | "IN"
  | "NOT IN"
  | "IS"
  | "IS NOT"
  | "ANY"
  | "@@";

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "CROSS" | "FULL";

export type OrderDirection = "ASC" | "DESC";

export type QueryType = "select" | "insert" | "update" | "delete" | "truncate";

export type Predicate = {
  readonly __brand: "predicate";
  readonly column: Column;
  readonly op: ComparisonOp;
  readonly value: any;
  readonly conjunction: "AND" | "OR";
  readonly children?: readonly Predicate[];
};

export type ColumnBuilder = {
  readonly equals: (value: any) => Predicate;
  readonly notEquals: (value: any) => Predicate;
  readonly greaterThan: (value: any) => Predicate;
  readonly greaterThanOrEqual: (value: any) => Predicate;
  readonly lessThan: (value: any) => Predicate;
  readonly lessThanOrEqual: (value: any) => Predicate;
  readonly isNull: () => Predicate;
  readonly isNotNull: () => Predicate;
  readonly inList: (values: readonly any[]) => Predicate;
  readonly notInList: (values: readonly any[]) => Predicate;
  readonly like: (value: any) => Predicate;
  readonly ilike: (value: any) => Predicate;
};

export type WhereBuilder = {
  (column: Column): ColumnBuilder;
  readonly or: (...predicates: Predicate[]) => Predicate;
  readonly raw: (fragment: Fragment) => Predicate;
};

export type WhereCallback = (q: WhereBuilder) => Predicate | readonly Predicate[];

export type JoinSpec = {
  readonly type: JoinType;
  readonly table: string;
  readonly alias?: string;
  readonly on: string | Fragment;
};

export type OrderSpec = {
  readonly column: Column;
  readonly direction: OrderDirection;
  readonly nulls?: "FIRST" | "LAST";
};

export type ConflictSpec = {
  readonly target: readonly string[];
  readonly action: "nothing" | "update";
  readonly updateColumns?: readonly string[];
  readonly excludeFromUpdate?: readonly string[];
  readonly setExtra?: Record<string, any>;
};

export type CteSpec = {
  readonly name: string;
  readonly query: Query;
  readonly recursive: boolean;
  readonly columns?: readonly string[];
};

export type Query = {
  readonly type: QueryType;
  readonly table: string;
  readonly alias?: string;
  readonly columns: readonly Column[];
  readonly wheres: readonly Predicate[];
  readonly joins: readonly JoinSpec[];
  readonly orderBy: readonly OrderSpec[];
  readonly groupBy: readonly Column[];
  readonly having: readonly Predicate[];
  readonly limitValue?: number;
  readonly offsetValue?: number;
  readonly returning: readonly Column[];
  readonly distinct: boolean | readonly Column[];
  readonly values: Record<string, any>;
  readonly batchValues?: readonly Record<string, any>[];
  readonly conflict?: ConflictSpec;
  readonly ctes: readonly CteSpec[];
  readonly insertFromSelect?: Query;
  readonly cascade?: boolean;
};

export type Dialect = "postgres" | "sqlite";

// SqlResult carries a phantom row type so Connection methods can infer it.
export type SqlResult<Row = unknown> = {
  readonly text: string;
  readonly values: readonly any[];
  readonly __row?: Row;
};

// Chainable is parameterized by:
//   Row      — the underlying table row shape
//   Selected — what a query returning rows yields (narrows after .select(...))
// Both default to `any` so untyped from("users") usage keeps working.
export type Chainable<Row = any, Selected = Row> = {
  readonly select: <K extends keyof Row & string>(...columns: K[]) => Chainable<Row, { [P in K]: Row[P] }>;
  readonly where: (callback: WhereCallback) => Chainable<Row, Selected>;
  readonly join: (table: string, on: string | Fragment, alias?: string) => Chainable<Row, Selected>;
  readonly leftJoin: (table: string, on: string | Fragment, alias?: string) => Chainable<Row, Selected>;
  readonly innerJoin: (table: string, on: string | Fragment, alias?: string) => Chainable<Row, Selected>;
  readonly orderBy: (column: Column, direction?: OrderDirection, nulls?: "FIRST" | "LAST") => Chainable<Row, Selected>;
  readonly groupBy: (...columns: Column[]) => Chainable<Row, Selected>;
  readonly having: (callback: WhereCallback) => Chainable<Row, Selected>;
  readonly limit: (n: number) => Chainable<Row, Selected>;
  readonly offset: (n: number) => Chainable<Row, Selected>;
  readonly returning: <K extends keyof Row & string>(...columns: K[]) => Chainable<Row, { [P in K]: Row[P] }>;
  readonly distinct: (...columns: Column[]) => Chainable<Row, Selected>;
  readonly insert: (data: Partial<Row> | Record<string, any>) => Chainable<Row, Selected>;
  readonly insertMany: (data: readonly (Partial<Row> | Record<string, any>)[]) => Chainable<Row, Selected>;
  readonly insertFrom: (columns: readonly string[], source: Chainable<any, any>) => Chainable<Row, Selected>;
  readonly truncate: (cascade?: boolean) => Chainable<Row, Selected>;
  readonly update: (data: Partial<Row> | Record<string, any>) => Chainable<Row, Selected>;
  readonly del: () => Chainable<Row, Selected>;
  readonly onConflict: (spec: ConflictSpec) => Chainable<Row, Selected>;
  readonly cte: (name: string, sub: Chainable<any, any>) => Chainable<Row, Selected>;
  readonly recursiveCte: (name: string, sub: Chainable<any, any>) => Chainable<Row, Selected>;
  readonly toSql: (dialect?: Dialect) => SqlResult<Selected>;
  readonly toQuery: () => Query;
};
