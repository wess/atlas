import { defineConfig, env } from "@wess/atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  host: env("HOST", { default: "0.0.0.0" }),
  databaseUrl: env("DATABASE_URL", { default: "postgres://localhost:5432/myapp" }),
  dbPoolSize: env("DB_POOL_SIZE", { parse: Number, default: "5" }),
  authSecret: env("AUTH_SECRET", { parse: (value) => {
    if (value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 random characters");
    return value;
  } }),
})
