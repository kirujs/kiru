import { parseAst } from "rollup/parseAst"
import type { TransformCTX } from "./shared.js"
import { prepareDeferSlotReads } from "./deferSlotReads.js"
import { prepareJSXHoisting } from "./hoistJSX.js"
import { prepareJSXTemplates } from "./prepareJSXTemplates.js"

/** Template shells (with holes) first, then hoist remaining static JSX. */
export function applyJsxHoistAndTemplates(ctx: TransformCTX): void {
  const before = ctx.code.toString()
  prepareDeferSlotReads(ctx)
  ctx.ast = parseAst(ctx.code.toString(), { allowReturnOutsideFunction: true })
  prepareJSXTemplates(ctx)
  ctx.ast = parseAst(ctx.code.toString(), { allowReturnOutsideFunction: true })
  prepareJSXHoisting(ctx)
  ctx.ast = parseAst(ctx.code.toString(), { allowReturnOutsideFunction: true })
  ctx.didTransform = ctx.code.toString() !== before
}

export function jsxTransformChanged(ctx: TransformCTX): boolean {
  return ctx.didTransform === true
}
