import { createCache } from "@atlas/cache"
import { config } from "./config.ts"

export const cache = createCache({ url: config.redisUrl })
