import type { AiProvider } from "../provider/index.ts";
import type { Conn } from "@atlas/server";
import { pipe, assign } from "@atlas/server";
import type { PipeFn } from "@atlas/server";

export const withAi = (ai: AiProvider): PipeFn => pipe((c: Conn) => assign(c, { ai }));
