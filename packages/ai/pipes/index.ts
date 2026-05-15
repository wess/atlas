import type { Conn, PipeFn } from "@atlas/server";
import { assign, pipe } from "@atlas/server";
import type { AiProvider } from "../provider/index.ts";

export const withAi = (ai: AiProvider): PipeFn => pipe((c: Conn) => assign(c, { ai }));
