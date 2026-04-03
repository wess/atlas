import { defineConfig, env } from "@atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  host: env("HOST", { default: "0.0.0.0" }),
  databaseUrl: env("DATABASE_URL", { default: "sqlite://socialnetwork.db" }),
  auth: {
    secret: env("AUTH_SECRET", { default: "change-me-in-production" }),
  },
  storage: {
    path: env("STORAGE_PATH", { default: "./uploads" }),
    s3Bucket: env("S3_BUCKET", { default: "" }),
    s3Region: env("S3_REGION", { default: "" }),
    s3AccessKey: env("S3_ACCESS_KEY", { default: "" }),
    s3SecretKey: env("S3_SECRET_KEY", { default: "" }),
  },
})
