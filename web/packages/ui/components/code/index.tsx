import type { ComponentProps } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "code", element: "code" });

export type CodeProps = ComponentProps<typeof Base> & { block?: boolean };

export const Code = ({ block, ...rest }: CodeProps) =>
  block ? (
    <pre className="atlas-codeblock">
      <Base {...rest} />
    </pre>
  ) : (
    <Base {...rest} />
  );
