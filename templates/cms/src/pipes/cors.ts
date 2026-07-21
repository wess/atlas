import { pipe, putHeader } from "@atlas/server"

export const cors = pipe((c) =>
  putHeader(
    putHeader(putHeader(c, "access-control-allow-origin", "*"), "access-control-allow-methods", "GET, OPTIONS"),
    "access-control-allow-headers",
    "content-type, x-api-key",
  ),
)
