import type { z } from "zod";

export type ChangesetResult<T> = {
  readonly valid: boolean;
  readonly changes: Partial<T>;
  readonly errors: Record<string, string[]>;
};

export type ChangesetOptions<T> = {
  cast: (keyof T)[];
  required?: (keyof T)[];
  validate?: Record<string, z.ZodType>;
};

type SchemaLike = { readonly table: string };

export const changeset = <T extends Record<string, unknown>>(_schema: SchemaLike, options: ChangesetOptions<T>) => {
  const { cast, required = [], validate = {} } = options;

  return (data: Partial<T>): ChangesetResult<T> => {
    const errors: Record<string, string[]> = {};

    const changes = cast.reduce(
      (acc, key) => {
        const k = key as string;
        if (k in (data as Record<string, unknown>)) {
          (acc as Record<string, unknown>)[k] = (data as Record<string, unknown>)[k];
        }
        return acc;
      },
      {} as Partial<T>,
    );

    for (const key of required) {
      const k = key as string;
      if (!(k in changes) || changes[key as keyof T] === undefined || changes[key as keyof T] === null) {
        errors[k] = [...(errors[k] ?? []), `${k} is required`];
      }
    }

    for (const [field, schema] of Object.entries(validate)) {
      if (!(field in changes)) continue;
      const result = schema.safeParse(changes[field as keyof T]);
      if (!result.success) {
        errors[field] = [...(errors[field] ?? []), ...result.error.issues.map((i) => i.message)];
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      changes,
      errors,
    };
  };
};
