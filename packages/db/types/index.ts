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

export type SqlResult = {
  readonly text: string;
  readonly values: readonly any[];
};

export type Chainable = {
  readonly select: (...columns: Column[]) => Chainable;
  readonly where: (callback: WhereCallback) => Chainable;
  readonly join: (table: string, on: string | Fragment, alias?: string) => Chainable;
  readonly leftJoin: (table: string, on: string | Fragment, alias?: string) => Chainable;
  readonly innerJoin: (table: string, on: string | Fragment, alias?: string) => Chainable;
  readonly orderBy: (column: Column, direction?: OrderDirection, nulls?: "FIRST" | "LAST") => Chainable;
  readonly groupBy: (...columns: Column[]) => Chainable;
  readonly having: (callback: WhereCallback) => Chainable;
  readonly limit: (n: number) => Chainable;
  readonly offset: (n: number) => Chainable;
  readonly returning: (...columns: Column[]) => Chainable;
  readonly distinct: (...columns: Column[]) => Chainable;
  readonly insert: (data: Record<string, any>) => Chainable;
  readonly insertMany: (data: readonly Record<string, any>[]) => Chainable;
  readonly insertFrom: (columns: readonly string[], source: Chainable) => Chainable;
  readonly truncate: (cascade?: boolean) => Chainable;
  readonly update: (data: Record<string, any>) => Chainable;
  readonly del: () => Chainable;
  readonly onConflict: (spec: ConflictSpec) => Chainable;
  readonly cte: (name: string, sub: Chainable) => Chainable;
  readonly recursiveCte: (name: string, sub: Chainable) => Chainable;
  readonly toSql: (dialect?: Dialect) => SqlResult;
  readonly toQuery: () => Query;
};
