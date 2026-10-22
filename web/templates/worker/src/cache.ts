import { createCache } from "@wess/atlas/cache"
import { config } from "./config.ts"

export const cache = createCache({ url: config.redisUrl })
