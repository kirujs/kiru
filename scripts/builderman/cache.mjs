import { pnpm } from "@builderman/resolvers-pnpm"

/**
 * @param {{
 *   lib: import('builderman').Task
 *   vitePlugin: import('builderman').Task
 *   runtime: import('builderman').Task
 *   adapterNode: import('builderman').Task
 *   adapterBun: import('builderman').Task
 *   adapterCloudflare: import('builderman').Task
 * }} pkgs
 */
export function createE2eCacheConfig(pkgs) {
  const { lib, vitePlugin, runtime, adapterNode, adapterBun, adapterCloudflare } = pkgs
  return {
    inputs: [
      "src",
      lib.artifact("build"),
      vitePlugin.artifact("build"),
      runtime.artifact("build"),
      adapterNode.artifact("build"),
      adapterBun.artifact("build"),
      adapterCloudflare.artifact("build"),
      pnpm.package(),
    ],
    outputs: ["dist"],
  }
}

/** @param {ReturnType<typeof createE2eCacheConfig>} E2ECachConfig */
export function createE2eCyCaches(E2ECachConfig) {
  return {
    e2eCyOnlyCache: {
      inputs: [...E2ECachConfig.inputs, "cypress"],
      outputs: [],
    },
    csrCyCache: {
      inputs: ["src", "cypress", pnpm.package()],
      outputs: [],
    },
    ssrCyCache: {
      inputs: [
        ...E2ECachConfig.inputs,
        "cypress",
        "cypress.shard-core.config.ts",
        "cypress.shard-loaders.config.ts",
        "cypress.shard-streaming.config.ts",
        "cypress.shard-actions.config.ts",
        "cypress.tier3.config.ts",
      ],
      outputs: [],
    },
  }
}

export const matrixCellCache = {
  inputs: ["scripts", "src", "vite.config.ts", "wrangler.toml", pnpm.package()],
  outputs: ["dist/cells"],
}
