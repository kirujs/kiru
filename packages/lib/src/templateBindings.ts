import { updateDomProps, unmountDomProps } from "./dom/props.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"
import type { TemplateBindingDescriptor } from "./template.js"
import type { HydratedTemplateInstance } from "./templateHydration.js"
import type { DomVNode, SomeElement } from "./types.utils.js"

type VNode = Kiru.VNode

type TemplateBindingState = {
  readonly proxy: DomVNode
  props: Record<string, unknown>
}

function ensureBindingStates(vNode: VNode): TemplateBindingState[] {
  if (!vNode.templateBindingStates) {
    vNode.templateBindingStates = []
  }
  return vNode.templateBindingStates as TemplateBindingState[]
}

function propsForNodeIndex(
  nodeIndex: number,
  bindings: readonly TemplateBindingDescriptor[],
  payloads: readonly (Record<string, unknown> | undefined)[] | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (payloads?.[nodeIndex]) {
    Object.assign(out, payloads[nodeIndex])
    return out
  }
  for (const b of bindings) {
    if (b.nodeIndex !== nodeIndex) continue
    // Descriptors without payloads are codegen-only metadata.
  }
  return out
}

function mergedPropsByNodeIndex(
  bindings: readonly TemplateBindingDescriptor[],
  payloads: readonly (Record<string, unknown> | undefined)[] | undefined
): Map<number, Record<string, unknown>> {
  const byIndex = new Map<number, Record<string, unknown>>()
  const indices = new Set<number>()
  for (const b of bindings) indices.add(b.nodeIndex)
  if (payloads) {
    for (let i = 0; i < payloads.length; i++) {
      if (payloads[i] !== undefined) indices.add(i)
    }
  }
  for (const nodeIndex of indices) {
    const props = propsForNodeIndex(nodeIndex, bindings, payloads)
    if (Object.keys(props).length > 0) {
      byIndex.set(nodeIndex, props)
    }
  }
  return byIndex
}

/** Binding phase: attach behaviors using projected nodes and compile-time nodeIndex. */
export function activateTemplateBindings(
  vNode: VNode,
  instance: HydratedTemplateInstance
): void {
  const bindings = vNode.templateBindings
  if (!bindings?.length) return

  const map = instance.nodes
  const payloads = vNode.templateBindingPayloads
  const propsByIndex = mergedPropsByNodeIndex(bindings, payloads)
  if (propsByIndex.size === 0) return

  const states = ensureBindingStates(vNode)
  const seen = new Set<number>()

  for (const [nodeIndex, nextProps] of propsByIndex) {
    seen.add(nodeIndex)
    const target = map[nodeIndex]
    if (!target) continue

    let state = states.find((s) => s.proxy.dom === target)
    if (!state) {
      const proxy = {
        dom: target,
        props: {},
        cleanups: {},
        prev: null,
      } as DomVNode
      state = { proxy, props: {} }
      states.push(state)
    }

    const prevProps = state.props
    if (prevProps === nextProps) continue
    state.proxy.props = nextProps
    state.proxy.prev = { props: prevProps } as DomVNode["prev"]
    updateDomProps(state.proxy)
    state.props = nextProps
    state.proxy.prev = { props: nextProps } as DomVNode["prev"]
  }

  for (let i = states.length - 1; i >= 0; i--) {
    const state = states[i]!
    const target = state.proxy.dom as SomeElement
    const nodeIndex = map.indexOf(target)
    if (nodeIndex === -1 || !seen.has(nodeIndex)) {
      unmountDomProps(state.proxy, target, state.props, state.proxy.cleanups)
      states.splice(i, 1)
    }
  }
}

export function applyTemplateBindings(vNode: VNode): void {
  const bindings = vNode.templateBindings
  if (!bindings?.length) return

  const instance = vNode.templateHydrated
  if (instance) {
    activateTemplateBindings(vNode, instance)
    return
  }

  throw new KiruError({
    message:
      "[kiru]: applyTemplateBindings requires hydrated template projections (structuralWalk)",
    vNode,
  })
}

export function unmountTemplateBindings(vNode: VNode): void {
  const states = vNode.templateBindingStates as TemplateBindingState[] | undefined
  if (!states?.length) return
  for (const state of states) {
    unmountDomProps(
      state.proxy,
      state.proxy.dom!,
      state.props,
      state.proxy.cleanups
    )
  }
  vNode.templateBindingStates = undefined
}
