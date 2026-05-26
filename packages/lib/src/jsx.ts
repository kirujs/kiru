// @ts-nocheck
import { createJsxElement, Fragment } from "./element.js"
export { Fragment }

export function jsx(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey
): Kiru.Element {
  return createJsxElement(type, props, key, false)
}

export function jsxs(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey
): Kiru.Element {
  return createJsxElement(type, props, key, true)
}

// TODO: use extra parameters for dev mode
export function jsxDEV(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey,
  isStaticChildren?: boolean,
  source?: { fileName: string; lineNumber: number; columnNumber: number },
  self?: unknown
): Kiru.Element {
  return createJsxElement(type, props, key, !!isStaticChildren)
}
