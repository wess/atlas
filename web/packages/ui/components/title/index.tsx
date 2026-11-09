import type { ComponentProps } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "title", element: "h1" });

export type TitleProps = ComponentProps<typeof Base> & { order?: 1 | 2 | 3 | 4 | 5 | 6 };

export const Title = ({ order = 1, ...rest }: TitleProps) => <Base as={`h${order}`} {...rest} />;
