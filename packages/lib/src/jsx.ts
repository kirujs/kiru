// @ts-nocheck
import { createElement, Fragment } from "./element.js"
export { Fragment }

export function jsx(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey
): Kiru.Element {
  return createElement(type, { ...props, key })
}

// TODO: use static children inference for performance
export function jsxs(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey
): Kiru.Element {
  return createElement(type, { ...props, key })
}

// TODO: use extra parameters for dev move
export function jsxDEV(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key?: JSX.ElementKey,
  isStaticChildren?: boolean,
  source?: { fileName: string; lineNumber: number; columnNumber: number },
  self?: unknown
): Kiru.Element {
  return createElement(type, { ...props, key })
}
