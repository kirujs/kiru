import { createRequire } from "node:module"
import path from "node:path"
import type { SharpFactory } from "./processImage.js"

export function loadSharp(projectRoot: string): SharpFactory | null {
  try {
    const require = createRequire(path.join(projectRoot, "package.json"))
    return require("sharp") as SharpFactory
  } catch {
    return null
  }
}
