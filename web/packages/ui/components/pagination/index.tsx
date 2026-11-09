import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { component } from "../../factory/index.tsx";
import { pageRange } from "../../headless/index.tsx";

const Base = component({ name: "pagination", element: "nav" });

export type PaginationProps = Omit<ComponentProps<typeof Base>, "onChange" | "children"> & {
  total: number;
  value: number;
  onChange: (page: number) => void;
};

export const Pagination = ({ total, value, onChange, ...rest }: PaginationProps) => (
  <Base aria-label="Pagination" {...rest}>
    <button type="button" aria-label="Previous page" disabled={value <= 1} onClick={() => onChange(value - 1)}>
      <ChevronLeft size={16} />
    </button>
    {pageRange(total, value).map((item, index) =>
      item === "dots" ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: dots have no identity beyond their slot
        <span key={`dots-${index}`} aria-hidden="true">
          …
        </span>
      ) : (
        <button
          key={item}
          type="button"
          aria-current={item === value ? "page" : undefined}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ),
    )}
    <button type="button" aria-label="Next page" disabled={value >= total} onClick={() => onChange(value + 1)}>
      <ChevronRight size={16} />
    </button>
  </Base>
);
