import { parseAst } from "rollup/parseAst"
import type { TransformCTX } from "../shared.js"
import { hasUseDomPragma, findUseDomPragmaStatement } from "../domPragma.js"
import { createDomSerializeCtx } from "./context.js"
import { findDomCompileUnits, type DomCompileUnit } from "./findUnits.js"
import {
  emitDomSetupFromJsx,
  emitMountComponentCallback,
  formatTemplateDecl,
  type DomInstallEmitOptions,
  type DomTemplateDecl,
} from "./emitSetup.js"
import { mergeDomImports, findEndOfLastImport } from "./imports.js"

function stripUseDomFromSource(source: string): string {
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const stmt = findUseDomPragmaStatement(ast)
  if (!stmt) return source
  let end = stmt.end as number
  if (source[end] === "\r" && source[end + 1] === "\n") end += 2
  else if (source[end] === "\n") end += 1
  return source.slice(0, stmt.start as number) + source.slice(end)
}

function renderArrowParamFromReturn(
  unit: Extract<DomCompileUnit, { kind: "render" }>,
  source: string
): string {
  const returnStmt = source.slice(unit.replaceStart, unit.replaceEnd).trim()
  const arrowMatch = returnStmt.match(
    /^return\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/
  )
  return arrowMatch?.[1] ?? "props"
}

function cacheVarForRoot(rootExpr: string): string {
  return `__renderRoot${rootExpr}`
}

function formatRenderReturn(
  unit: Extract<DomCompileUnit, { kind: "render" }>,
  rootExpr: string,
  setup: string,
  source: string
): string {
  if (!unit.wrapInRenderArrow) {
    return setup.length > 0
      ? `${setup}\nreturn ${rootExpr}`
      : `return ${rootExpr}`
  }
  if (unit.renderArrowParamCount === 0) {
    if (setup.length === 0) {
      return `return () => ${rootExpr}`
    }
    return `return () => {\n${setup}\nreturn ${rootExpr}\n  }`
  }
  const param = renderArrowParamFromReturn(unit, source)
  if (setup.length === 0) {
    return `return ${param} => ${rootExpr}`
  }
  const cacheVar = cacheVarForRoot(rootExpr)
  const body = setup
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
  return `return ${param} => {
    let ${cacheVar};
    if (!${cacheVar}) {
${body}
      ${cacheVar} = ${rootExpr};
    }
    return ${cacheVar};
  }`
}

function installEmitOptions(
  unit: Extract<DomCompileUnit, { kind: "render" }>
): DomInstallEmitOptions | undefined {
  const once =
    unit.installInOuterSetup ||
    unit.installInPropsArrowOnce ||
    unit.installInPropsBlock ||
    !unit.wrapInRenderArrow
  return once ? { livePropsInInstall: true, renderParamName: "props" } : undefined
}

export function applyDomCodegen(ctx: TransformCTX): boolean {
  if (!hasUseDomPragma(ctx.ast)) return false

  let source = stripUseDomFromSource(ctx.code.toString())
  const ast = parseAst(source, { allowReturnOutsideFunction: true })
  const serializeCtx = createDomSerializeCtx(ast)
  const units = findDomCompileUnits(serializeCtx.bodyNodes, serializeCtx)
  if (units.length === 0) return false

  const templateDecls: DomTemplateDecl[] = []
  const neededImports = new Set<string>()
  const nextTemplateId = { n: 0 }
  const replacements: { start: number; end: number; text: string }[] = []

  for (const unit of units) {
    if (unit.kind === "mount_component") {
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text: emitMountComponentCallback(
          unit.jsxRoot,
          source,
          serializeCtx,
          neededImports
        ),
      })
      continue
    }

    const emitted = emitDomSetupFromJsx(
      unit.jsxRoot,
      source,
      serializeCtx,
      templateDecls,
      nextTemplateId,
      neededImports,
      unit.kind === "render" ? installEmitOptions(unit) : undefined
    )

    if (unit.kind === "mount_intrinsic_expr") {
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text: `{ ${emitted.setupLines.join("\n")}\nreturn ${emitted.returnExpr} }`,
      })
      continue
    }

    const setup = emitted.setupLines.join("\n")

    if (unit.installInOuterSetup) {
      const param = renderArrowParamFromReturn(unit, source)
      if (setup.length === 0) {
        replacements.push({
          start: unit.replaceStart,
          end: unit.replaceEnd,
          text: `return ${param} => ${emitted.returnExpr}`,
        })
      } else {
        const cacheVar = cacheVarForRoot(emitted.returnExpr)
        const body = setup
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")
        replacements.push({
          start: unit.replaceStart,
          end: unit.replaceEnd,
          text: `return ${param} => {
    let ${cacheVar};
    if (!${cacheVar}) {
${body}
      ${cacheVar} = ${emitted.returnExpr};
    }
    return ${cacheVar};
  }`,
        })
      }
      continue
    }

    if (unit.installInPropsBlock) {
      if (setup.length > 0) {
        replacements.push({
          start: unit.preserveEnd,
          end: unit.preserveEnd,
          text: `\n${setup}\n`,
        })
      }
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text: `return ${emitted.returnExpr}`,
      })
      continue
    }

    if (unit.installInPropsArrowOnce) {
      const cacheVar = cacheVarForRoot(emitted.returnExpr)
      const body = setup
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text:
          setup.length > 0
            ? `let ${cacheVar};\nif (!${cacheVar}) {\n${body}\n  ${cacheVar} = ${emitted.returnExpr};\n}\nreturn () => ${cacheVar}`
            : `return () => ${emitted.returnExpr}`,
      })
      continue
    }

    if (!unit.wrapInRenderArrow && setup.length > 0) {
      const cacheVar = cacheVarForRoot(emitted.returnExpr)
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text: `let ${cacheVar};\nif (!${cacheVar}) {\n${setup}\n  ${cacheVar} = ${emitted.returnExpr};\n}\nreturn ${cacheVar}`,
      })
      continue
    }

    if (unit.wrapInRenderArrow) {
      replacements.push({
        start: unit.replaceStart,
        end: unit.replaceEnd,
        text: formatRenderReturn(
          unit,
          emitted.returnExpr,
          setup,
          source
        ),
      })
      continue
    }

    replacements.push({
      start: unit.replaceStart,
      end: unit.replaceEnd,
      text:
        setup.length > 0
          ? `${setup}\nreturn ${emitted.returnExpr}`
          : `return ${emitted.returnExpr}`,
    })
  }

  replacements.sort((a, b) => b.start - a.start)
  for (const edit of replacements) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
  }

  const templateLines = [
    ...new Set(templateDecls.map((d) => formatTemplateDecl(d.varName, d.result))),
  ]

  if (templateLines.length > 0) {
    const insertAt = findEndOfLastImport(source)
    source =
      source.slice(0, insertAt) +
      `\n${templateLines.join("\n")}\n` +
      source.slice(insertAt)
  }

  source = mergeDomImports(source, neededImports)
  ctx.code.overwrite(0, ctx.code.length(), source)
  ctx.didTransform = true
  return true
}
