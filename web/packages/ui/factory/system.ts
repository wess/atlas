import type { CSSProperties } from "react";

export const sizes = ["xs", "sm", "md", "lg", "xl"] as const;
export const colors = ["primary", "danger", "success", "accent", "neutral"] as const;

export type Size = (typeof sizes)[number];
export type Color = (typeof colors)[number];
export type Spacing = Size | number | (string & {});

export type SystemProps = {
  p?: Spacing;
  pt?: Spacing;
  mt?: Spacing;
  mb?: Spacing;
  mx?: Spacing;
  my?: Spacing;
  gap?: Spacing;
  w?: number | string;
  h?: number | string;
  maw?: number | string;
  flex?: number | string;
  fw?: number;
  tt?: CSSProperties["textTransform"];
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
};

const spacing = (value: Spacing) =>
  typeof value === "number" ? `${value}px` : sizes.includes(value as Size) ? `var(--atlas-space-${value})` : value;
const dimension = (value: number | string) => (typeof value === "number" ? `${value}px` : value);
const raw = <T>(value: T) => value;

const rules: Record<keyof SystemProps, [keyof CSSProperties, (value: any) => unknown]> = {
  p: ["padding", spacing],
  pt: ["paddingTop", spacing],
  mt: ["marginTop", spacing],
  mb: ["marginBottom", spacing],
  mx: ["marginInline", spacing],
  my: ["marginBlock", spacing],
  gap: ["gap", spacing],
  w: ["width", dimension],
  h: ["height", dimension],
  maw: ["maxWidth", dimension],
  flex: ["flex", raw],
  fw: ["fontWeight", raw],
  tt: ["textTransform", raw],
  justify: ["justifyContent", raw],
  align: ["alignItems", raw],
};

export const splitSystem = <P extends Record<string, unknown>>(props: P) => {
  const style: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const rule = rules[key as keyof SystemProps];
    if (!rule) rest[key] = value;
    else if (value !== undefined) style[rule[0]] = rule[1](value);
  }
  return { system: style as CSSProperties, rest: rest as Omit<P, keyof SystemProps> };
};

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
