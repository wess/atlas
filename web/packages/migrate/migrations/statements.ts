// bun:sqlite prepares only the first statement of a string, so a migration file has to be split.
// quotes, comments, and trigger bodies can all hold a semicolon that doesn't end a statement.
export const splitSqlite = (sql: string): string[] => {
  const statements: string[] = [];
  let start = 0;
  let depth = 0;
  let i = 0;
  const words = (from: number) =>
    sql
      .slice(from)
      .match(/^[A-Za-z_]+/)?.[0]
      ?.toUpperCase();
  const isWordStart = (at: number) => at === 0 || !/[A-Za-z0-9_]/.test(sql[at - 1]!);
  const push = (end: number) => {
    const text = sql.slice(start, end).trim();
    if (text.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim()) statements.push(text);
  };
  while (i < sql.length) {
    const ch = sql[i]!;
    const close = { "'": "'", '"': '"', "`": "`", "[": "]" }[ch];
    if (close) {
      const end = sql.indexOf(close, i + 1);
      i = end < 0 ? sql.length : end + 1;
      // a doubled quote is an escaped one, and the loop picks the rest up as a new quoted run
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (isWordStart(i) && /[A-Za-z]/.test(ch)) {
      const word = words(i)!;
      // BEGIN opens a trigger body only inside CREATE TRIGGER; a bare BEGIN is a transaction statement
      if (word === "BEGIN" && /\bTRIGGER\b/i.test(sql.slice(start, i))) depth += 1;
      else if ((word === "END" || word === "CASE") && depth > 0) depth += word === "CASE" ? 1 : -1;
      i += word.length;
      continue;
    }
    if (ch === ";" && depth === 0) {
      push(i);
      start = i + 1;
    }
    i += 1;
  }
  push(sql.length);
  return statements;
};
