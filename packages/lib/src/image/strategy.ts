import type { ImageConfig } from "./types.js"

export function usesRuntimeImageOptimizer(
  config: Pick<ImageConfig, "strategy" | "unoptimized">
): boolean {
  return config.strategy === "runtime" && !config.unoptimized
}

export function usesBuildImageStrategy(
  config: Pick<ImageConfig, "strategy" | "unoptimized">
): boolean {
  return config.strategy === "build" && !config.unoptimized
}
