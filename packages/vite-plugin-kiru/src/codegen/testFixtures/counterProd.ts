/** Production-shaped JSX (jsx/jsxs from kiru/jsx-runtime) mirroring sandbox/primitive. */

export const JSX_RUNTIME_IMPORT = 'import { jsx, jsxs } from "kiru/jsx-runtime"'

export const VITE_RESOLVED_JSX_RUNTIME_IMPORT =
  'import { jsx, jsxs } from "/@fs/C:/repos/kiru/kiru/packages/lib/dist/jsx.js"'

export const BADGE_COMPONENT = `
const Badge = () => jsx("span", { className: "badge", children: "OK" })
`

export const COUNTER_DIRECT_RETURN = `
${JSX_RUNTIME_IMPORT}
import { signal } from "kiru"

const count = signal(0)
export const Counter = () => {
  return jsxs("div", { children: [
    jsxs("h1", { children: ["Count: ", count] }),
    jsx("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }),
    jsx(Badge, {}),
    jsx("div", { children: 123 }),
  ] })
}
${BADGE_COMPONENT}
`

export const COUNTER_SETUP_RETURN_MODULE_COUNT = `
${JSX_RUNTIME_IMPORT}
import { signal } from "kiru"

const count = signal(0)
export const Counter = () => {
  return () => jsxs("div", { children: [
    jsxs("h1", { children: ["Count: ", count] }),
    jsx("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }),
    jsx(Badge, {}),
    jsx("div", { children: 123 }),
  ] })
}
${BADGE_COMPONENT}
`

export const COUNTER_SETUP_RETURN_SETUP_COUNT = `
${JSX_RUNTIME_IMPORT}
import { signal } from "kiru"

${BADGE_COMPONENT}

export const Counter = () => {
  const count = signal(0)
  return () => jsxs("div", { children: [
    jsxs("h1", { children: ["Count: ", count] }),
    jsx("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }),
    jsx(Badge, {}),
    jsx("div", { children: 123 }),
  ] })
}
`

export const ANOTHER_COUNTER_SETUP_RETURN = `
${JSX_RUNTIME_IMPORT}
import { signal } from "kiru"

${BADGE_COMPONENT}

export const AnotherCounter = () => {
  const count = signal(0)
  return () => jsxs("div", { children: [
    jsxs("h1", { children: ["Count: ", count] }),
    jsx("button", { onclick: () => count.set((c) => c + 1), children: "Increment" }),
    jsx(Badge, {}),
  ] })
}
`

export const APP_SETUP_RETURN = `
${JSX_RUNTIME_IMPORT}
import { signal } from "kiru"
import { AnotherCounter, Counter } from "./counter"

export function App() {
  const toggled = signal(false)
  return () => jsxs("div", { children: [
    jsx("h1", { children: "Static content" }),
    jsx("button", { onclick: () => toggled.set((t) => !t), children: "Toggle" }),
    toggled() && jsx(Counter, {}),
    jsx(AnotherCounter, {}),
  ] })
}
`
