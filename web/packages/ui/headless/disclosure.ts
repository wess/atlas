import { useMemo, useState } from "react";

export const useDisclosure = (initial = false) => {
  const [opened, setOpened] = useState(initial);
  const handlers = useMemo(
    () => ({
      open: () => setOpened(true),
      close: () => setOpened(false),
      toggle: () => setOpened((current) => !current),
    }),
    [],
  );
  return [opened, handlers] as const;
};
