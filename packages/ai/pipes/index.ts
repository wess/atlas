import type { Conn, PipeFn } from "../../server/index.ts";
import { assign, pipe } from "../../server/index.ts";
import type { AiProvider } from "../provider/index.ts";

export const withAi = (ai: AiProvider): PipeFn => pipe((c: Conn) => assign(c, { ai }));
