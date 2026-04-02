export type ServerAdapter<TConfig = unknown> = {
  readonly name: string;
  readonly start: (config: TConfig) => { stop: () => void };
};

export type ComposedServer = {
  readonly stop: () => void;
  readonly adapters: Record<string, { stop: () => void }>;
};

export const createAdapter = <TConfig>(
  name: string,
  start: (config: TConfig) => { stop: () => void },
): ServerAdapter<TConfig> => ({ name, start });

export const compose = (adapters: { adapter: ServerAdapter<any>; config: any }[]): ComposedServer => {
  const running: Record<string, { stop: () => void }> = {};
  for (const { adapter, config } of adapters) {
    running[adapter.name] = adapter.start(config);
  }
  return {
    stop: () => {
      for (const a of Object.values(running)) a.stop();
    },
    adapters: running,
  };
};
