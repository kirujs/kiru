import type { AppType } from "@/server/hono-entry"
import { hc } from "hono/client"

export const client = hc<AppType>(
  import.meta.env.DEV ? "http://localhost:5173" : "http://localhost:3000"
)
