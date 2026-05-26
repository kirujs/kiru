import { voidElements } from "../constants.js"
import { encodeHtmlEntities, propsToElementAttributes } from "./format.js"

/** Solid-compatible structural hole marker (comment node in template HTML). */
export const KIRU_HOLE_MARKER = "<!--#-->"

export function encodeStaticText(text: string): string {
  return encodeHtmlEntities(text)
}

/**
 * Serialize a static element to an HTML string (same rules as headlessRender).
 * `innerHtml` must already be entity-encoded static markup (may include hole markers).
 */
export function serializeStaticElementToHtml(
  tag: string,
  props: Record<string, unknown>,
  innerHtml = ""
): string {
  const { children: _c, ref: _r, key: _k, innerHTML: _i, ...attrs } = props
  const attrString = propsToElementAttributes(attrs)
  const open = attrString.length
    ? `<${tag} ${attrString}>`
    : `<${tag}>`
  if (voidElements.has(tag)) return open
  return `${open}${innerHtml}</${tag}>`
}
