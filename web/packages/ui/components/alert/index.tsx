import type { ComponentProps } from "react";
import { colors, component } from "../../factory/index.tsx";

const Base = component({ name: "alert", variants: { color: colors }, defaults: { color: "primary" } });

export const Alert = (props: ComponentProps<typeof Base>) => <Base role="alert" {...props} />;
