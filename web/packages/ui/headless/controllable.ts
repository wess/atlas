import { useState } from "react";

export const useControllable = <T>(options: { value?: T; defaultValue: T; onChange?: (value: T) => void }) => {
  const [local, setLocal] = useState(options.defaultValue);
  const controlled = options.value !== undefined;
  const set = (next: T) => {
    if (!controlled) setLocal(next);
    options.onChange?.(next);
  };
  return [controlled ? (options.value as T) : local, set] as const;
};
