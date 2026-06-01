import {
  _template,
  cloneTemplateDom,
  type TemplateRoot,
} from "../template.js"
import {
  buildStructuralWalkFromMarkup,
  executeStructuralControlStream,
  type StructuralControlProjections,
} from "../templateStructuralWalk.js"

export type { TemplateRoot }

export function template(
  html: string,
  holeCount = 0,
  structuralNodeCount?: number,
  structuralWalk?: readonly number[]
): TemplateRoot {
  return _template(html, holeCount, structuralNodeCount, structuralWalk)
}

export function clone(tpl: TemplateRoot): Element {
  return cloneTemplateDom(tpl.html)
}

export function project(
  tpl: TemplateRoot,
  root: Element
): StructuralControlProjections {
  const walk =
    tpl.structuralWalk && tpl.structuralWalk.length > 0
      ? tpl.structuralWalk
      : buildStructuralWalkFromMarkup(tpl.html, { excludeShellRoot: true })
  return executeStructuralControlStream(root, walk, tpl.regions)
}
