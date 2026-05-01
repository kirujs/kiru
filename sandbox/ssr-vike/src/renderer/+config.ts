import type { Config } from "vike/types"

export default {
  clientRouting: true,
  meta: {
    title: {
      env: { server: true, client: true },
    },
    Layout: {
      // Load the value of /pages/**/+Layout.js on both the server and client
      env: { server: true, client: true },
      // Make it cumulative for nested layouts - this results in our config.Layout producing an array
      cumulative: true,
    },
  },
} satisfies Config
