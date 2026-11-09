const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

export const validateIdentifier = (name: string): string => {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(
      `Invalid SQL identifier: "${name}". Identifiers must contain only letters, numbers, underscores, and dots. This prevents SQL injection.`,
    );
  }
  return name;
};

export const isValidIdentifier = (name: string): boolean => {
  return IDENTIFIER_PATTERN.test(name);
};

const WILDCARD_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]*\.)?\*$/;

/**
 * A string column in where/having (`q(col)`), orderBy, groupBy, distinct, or
 * returning: an identifier (`email`, `u.email`), `*`, or `table.*`.
 * Expressions go through raw().
 */
export const validateColumn = (name: string): string => {
  if (IDENTIFIER_PATTERN.test(name) || WILDCARD_PATTERN.test(name)) return name;
  throw new Error(
    `Invalid column reference: "${name}". String columns must be an identifier, "table.column", "*", or "table.*". Use raw() for expressions such as functions, casts, or aliases.`,
  );
};

// Tokens that never appear in a legitimate select-list expression written as a
// plain string but are how injected SQL escapes it: statement separators,
// comments, string/identifier quotes, and placeholders that would mis-bind.
const UNSAFE_EXPRESSION = /;|--|\/\*|\*\/|['"`\\$]/;

// tab, newline, and carriage return are ordinary whitespace in a multi-line
// expression; any other control character is not
const hasControlChar = (value: string): boolean =>
  [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });

/**
 * A string entry in select(). Identifiers pass; so do developer-written
 * expressions like "COUNT(*) as total" or "u.name as author", as long as they
 * contain no statement separators, comments, quotes, or placeholders. Anything
 * needing those (string literals, parameters) belongs in raw().
 */
export const validateSelectColumn = (expr: string): string => {
  if (IDENTIFIER_PATTERN.test(expr) || WILDCARD_PATTERN.test(expr)) return expr;
  if (expr.trim() === "" || UNSAFE_EXPRESSION.test(expr) || hasControlChar(expr)) {
    throw new Error(
      `Unsafe select expression: "${expr}". Select strings may not contain ";", comments, quotes, "$" placeholders, or control characters. Use raw() with bound values instead.`,
    );
  }
  return expr;
};

const DIRECTIONS = new Set(["ASC", "DESC"]);
const NULLS = new Set(["FIRST", "LAST"]);

export const normalizeDirection = (direction: string): "ASC" | "DESC" => {
  const upper = typeof direction === "string" ? direction.toUpperCase() : "";
  if (!DIRECTIONS.has(upper)) throw new Error(`Invalid sort direction: "${String(direction)}". Expected ASC or DESC.`);
  return upper as "ASC" | "DESC";
};

export const normalizeNulls = (nulls: string): "FIRST" | "LAST" => {
  const upper = typeof nulls === "string" ? nulls.toUpperCase() : "";
  if (!NULLS.has(upper)) throw new Error(`Invalid NULLS ordering: "${String(nulls)}". Expected FIRST or LAST.`);
  return upper as "FIRST" | "LAST";
};
