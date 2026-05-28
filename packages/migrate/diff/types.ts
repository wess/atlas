import type { ColumnType } from "../../db/index.ts";

// Normalized column shape used by both introspection and schema-to-shape conversion.
export type LiveColumn = {
  readonly name: string;
  readonly type: ColumnType;
  readonly nullable: boolean;
  readonly primary: boolean;
  readonly hasDefault: boolean;
};

export type LiveTable = {
  readonly name: string;
  readonly columns: readonly LiveColumn[];
};

export type DiffOp =
  | { readonly kind: "create_table"; readonly table: LiveTable }
  | { readonly kind: "drop_table"; readonly table: LiveTable }
  | { readonly kind: "add_column"; readonly table: string; readonly column: LiveColumn }
  | { readonly kind: "drop_column"; readonly table: string; readonly column: LiveColumn }
  | {
      readonly kind: "alter_column";
      readonly table: string;
      readonly from: LiveColumn;
      readonly to: LiveColumn;
    };

export type DiffPlan = {
  readonly ops: readonly DiffOp[];
  readonly up: string;
  readonly down: string;
};
