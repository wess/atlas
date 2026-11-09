import { component, sizes } from "../../factory/index.tsx";

const Base = component({
  name: "loader",
  element: "span",
  variants: { size: sizes, type: ["ring", "dots"] },
  defaults: { size: "sm", type: "ring" },
});

export const Loader = (props: Parameters<typeof Base>[0]) => (
  <Base role="status" aria-label="Loading" {...props}>
    {props.type === "dots" && (
      <>
        <i />
        <i />
        <i />
      </>
    )}
  </Base>
);
