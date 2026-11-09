import type { ComponentProps, CSSProperties } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "simplegrid" });

export type Columns = number | { base?: number; sm?: number; lg?: number };
export type SimpleGridProps = ComponentProps<typeof Base> & { cols?: Columns };

export const SimpleGrid = ({ cols = 1, style, ...rest }: SimpleGridProps) => {
  const { base = 1, sm, lg } = typeof cols === "number" ? { base: cols, sm: undefined, lg: undefined } : cols;
  const columns = { "--cols": base, "--cols-sm": sm ?? base, "--cols-lg": lg ?? sm ?? base } as CSSProperties;
  return <Base style={{ ...columns, ...style }} {...rest} />;
};
