import type { ComponentProps, CSSProperties, ElementType } from "react";
import { cx, type SystemProps, splitSystem } from "./system.ts";

// an array declares an enum variant, true declares a flag; both land on data-* for scss
export type VariantMap = Record<string, readonly string[] | true>;
export type NoVariants = Record<never, never>;
export type VariantProps<V> = { [K in keyof V]?: V[K] extends readonly (infer O)[] ? O : boolean };

export type ComponentConfig<V, E> = {
  name: string;
  element?: E;
  variants?: V;
  defaults?: VariantProps<V>;
};

export type FactoryProps<V, E extends ElementType> = Omit<ComponentProps<E>, keyof V | keyof SystemProps> &
  VariantProps<V> &
  SystemProps & { as?: ElementType };

export const component = <const V extends VariantMap = NoVariants, E extends ElementType = "div">(
  config: ComponentConfig<V, E>,
) => {
  const base = `atlas-${config.name}`;
  const keys = new Set(Object.keys(config.variants ?? {}));
  const Fallback = config.element ?? "div";

  return ({ as, className, style, ...props }: FactoryProps<V, E>) => {
    const Tag: ElementType = as ?? Fallback;
    const data: Record<string, string> = {};
    const others: Record<string, unknown> = {};
    for (const [key, value] of Object.entries({ ...config.defaults, ...props })) {
      if (!keys.has(key)) others[key] = value;
      else if (value === true) data[`data-${key.toLowerCase()}`] = "";
      else if (value) data[`data-${key.toLowerCase()}`] = String(value);
    }
    const { system, rest } = splitSystem(others);
    const merged = { ...system, ...(style as CSSProperties | undefined) };
    return (
      <Tag
        className={cx(base, className as string | undefined)}
        style={Object.keys(merged).length ? merged : undefined}
        {...data}
        {...rest}
      />
    );
  };
};

export const compound = <R extends (props: any) => unknown, P extends Record<string, unknown>>(root: R, parts: P) =>
  Object.assign((props: Parameters<R>[0]) => root(props) as React.ReactNode, parts);
