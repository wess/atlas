import { type ComponentProps, createContext, useContext } from "react";
import { component, compound, cx, type SystemProps, splitSystem } from "../../factory/index.tsx";
import { useTabs } from "../../headless/index.tsx";

type TabsApi = ReturnType<typeof useTabs>;
const TabsContext = createContext<TabsApi | null>(null);

const useTabsContext = () => {
  const api = useContext(TabsContext);
  if (!api) throw new Error("Tabs parts must render inside <Tabs>");
  return api;
};

const Root = component({ name: "tabs" });
type RootProps = Omit<ComponentProps<typeof Root>, "onChange" | "defaultValue"> & {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
};

const TabsRoot = ({ value, defaultValue, onChange, ...rest }: RootProps) => (
  <TabsContext.Provider value={useTabs({ value, defaultValue, onChange })}>
    <Root {...rest} />
  </TabsContext.Provider>
);

const List = (props: ComponentProps<"div">) => (
  <div className="atlas-tabs__list" {...useTabsContext().getListProps()} {...props} />
);

const Tab = ({ value, className, ...props }: ComponentProps<"button"> & { value: string }) => (
  <button className={cx("atlas-tabs__tab", className)} {...useTabsContext().getTabProps(value)} {...props} />
);

const Panel = ({ value, style, ...props }: ComponentProps<"div"> & SystemProps & { value: string }) => {
  const { system, rest } = splitSystem(props);
  return (
    <div
      className="atlas-tabs__panel"
      style={{ ...system, ...style }}
      {...useTabsContext().getPanelProps(value)}
      {...rest}
    />
  );
};

export const Tabs = compound(TabsRoot, { List, Tab, Panel });
