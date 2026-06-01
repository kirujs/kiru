import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import {
  componentUpdateTarget,
  createDomComponentInstance,
  runWithDomInstance,
  type DomComponentInstance,
} from "./instance.js"
import {
  createOwner,
  disposeOwner,
  getCurrentOwner,
  runWithOwner,
} from "./owner.js"
import {
  disposeMountNode,
  isMountContentArray,
  mountManyBefore,
  mountNodeRoot,
} from "./mountContent.js"
import { mountBefore } from "./insert.js"
import type {
  ComponentHandle,
  DomAnchoredComponent,
  DomComponent,
  DomMountNode,
} from "./types.js"

type DomRoot = Element | Comment

type FactoryResult =
  | DomRoot
  | readonly DomRoot[]
  | (() => DomRoot | readonly DomRoot[])

type ResolvedComponent<P extends Record<string, unknown>> = {
  instance: DomComponentInstance<P>
  runSetup: (props: P) => void
  render: (props: P) => FactoryResult
}

function unwrapRenderResult(
  result: FactoryResult | (() => FactoryResult)
): FactoryResult {
  if (typeof result === "function" && (result as Function).length === 0) {
    return (result as () => FactoryResult)()
  }
  return result as FactoryResult
}

function resolveFactoryResult(
  result: FactoryResult
): () => DomRoot | readonly DomRoot[] {
  return typeof result === "function"
    ? (result as () => DomRoot | readonly DomRoot[])
    : () => result
}

function factoryResultToMountNodes(
  resolved: DomRoot | readonly DomRoot[]
): DomMountNode[] {
  if (isMountContentArray(resolved)) {
    return resolved as DomMountNode[]
  }
  return [resolved as DomMountNode]
}

function resolveComponentShape<P extends Record<string, unknown>>(
  fn: DomComponent<P> | DomAnchoredComponent<P>,
  initialProps: P,
  anchor?: Comment
): ResolvedComponent<P> {
  const instance = createDomComponentInstance(initialProps)

  if (anchor !== undefined && (fn as Function).length >= 2) {
    const anchored = fn as DomAnchoredComponent<P>
    return {
      instance,
      runSetup: () => {},
      render: (props) => anchored(props, anchor) as FactoryResult,
    }
  }

  const comp = fn as DomComponent<P>

  if (comp.length === 0) {
    let renderMid:
      | ((props: P) => FactoryResult | (() => FactoryResult))
      | (() => FactoryResult | (() => FactoryResult))
      | null = null
    return {
      instance,
      runSetup: () => {
        const mid = (comp as () => unknown)()
        if (typeof mid !== "function") {
          renderMid = () => mid as FactoryResult
          return
        }
        renderMid = mid as
          | ((props: P) => FactoryResult | (() => FactoryResult))
          | (() => FactoryResult | (() => FactoryResult))
      },
      render: (props) => {
        let midFn = renderMid
        if (!midFn) {
          const mid = (comp as () => unknown)()
          if (typeof mid !== "function") return mid as FactoryResult
          midFn = mid as NonNullable<typeof renderMid>
        }
        const result =
          midFn.length === 0
            ? (midFn as () => FactoryResult | (() => FactoryResult))()
            : (midFn as (props: P) => FactoryResult | (() => FactoryResult))(
                props
              )
        return unwrapRenderResult(result)
      },
    }
  }

  const first = comp(initialProps)
  if (typeof first === "function") {
    const inner = first as (
      props?: P
    ) => FactoryResult | (() => FactoryResult)
    if (inner.length >= 1) {
      return {
        instance,
        runSetup: () => {},
        render: (props) => unwrapRenderResult(inner(props)),
      }
    }
    return {
      instance,
      runSetup: () => {},
      render: () => unwrapRenderResult(inner()),
    }
  }

  return {
    instance,
    runSetup: () => {},
    render: (props) => comp(props) as FactoryResult,
  }
}

export function createComponent<P extends Record<string, unknown>>(
  fn: DomComponent<P>,
  props: P,
  anchor?: Comment
): ComponentHandle<P>
export function createComponent<P extends Record<string, unknown>>(
  fn: DomAnchoredComponent<P>,
  props: P,
  anchor?: Comment
): ComponentHandle<P>
export function createComponent<P extends Record<string, unknown>>(
  fn: DomComponent<P> | DomAnchoredComponent<P>,
  props: P,
  anchor?: Comment
): ComponentHandle<P> {
  if (componentUpdateTarget) {
    componentUpdateTarget.updateProps(props)
    return componentUpdateTarget as ComponentHandle<P>
  }

  const parent = getCurrentOwner()
  const setupOwner = createOwner(parent)
  let renderOwner = createOwner(setupOwner)

  const resolved = resolveComponentShape(fn, props, anchor)
  let renderProps = props

  resolved.instance.syncProps(props)

  runWithOwner(setupOwner, () => {
    runWithDomInstance(resolved.instance, () => {
      resolved.runSetup(props)
    })
  })

  function runRender(): DomMountNode[] {
    return runWithOwner(renderOwner, () => {
      return runWithDomInstance(resolved.instance, () => {
        const result = resolveFactoryResult(resolved.render(renderProps))()
        return factoryResultToMountNodes(result)
      })
    })
  }

  let mountAnchor: Comment | undefined = anchor
  let mountedNodes: DomMountNode[] = []
  const preservedRoot: DomRoot | undefined = anchor

  function disposeRenderNodes(): void {
    for (const node of mountedNodes) {
      const root = mountNodeRoot(node)
      if (preservedRoot && root === preservedRoot) continue
      disposeMountNode(node)
    }
    mountedNodes = []
  }

  function insertRenderNodes(nodes: DomMountNode[]): void {
    if (!mountAnchor || nodes.length === 0) return
    if (nodes.length === 1) {
      mountBefore(mountAnchor, nodes[0]!)
    } else {
      mountManyBefore(mountAnchor, nodes)
    }
  }

  function captureMountAnchor(nodes: DomMountNode[]): void {
    if (mountAnchor || nodes.length === 0) return
    const root = mountNodeRoot(nodes[0]!)
    const parentNode = root.parentNode
    if (!parentNode) return
    const marker = document.createComment("")
    parentNode.insertBefore(marker, root)
    mountAnchor = marker
  }

  function renderRootsMatch(next: DomMountNode[]): boolean {
    if (mountedNodes.length !== next.length) return false
    for (let i = 0; i < next.length; i++) {
      if (mountNodeRoot(mountedNodes[i]!) !== mountNodeRoot(next[i]!)) {
        return false
      }
    }
    return true
  }

  /** Re-run render after syncProps; repaint only when mount root shape changes. */
  function patchTemplate(): void {
    const nextNodes = runRender()
    if (mountedNodes.length > 0 && renderRootsMatch(nextNodes)) {
      return
    }
    runWithOwner(setupOwner, () => {
      paint()
    })
  }

  function paint(): void {
    if (!mountAnchor && mountedNodes.length > 0) {
      captureMountAnchor(mountedNodes)
    }
    disposeRenderNodes()
    if (!renderOwner.disposed) {
      disposeOwner(renderOwner)
    }
    renderOwner = createOwner(setupOwner)
    mountedNodes = runRender()
    insertRenderNodes(mountedNodes)
    captureMountAnchor(mountedNodes)
  }

  runWithOwner(setupOwner, () => {
    paint()
  })

  let disposed = false

  const handle: ComponentHandle<P> = {
    owner: setupOwner,
    instance: resolved.instance,
    getRoot(): DomRoot {
      if (mountedNodes.length === 0) {
        throw new Error("[kiru/dom]: component factory returned no mount content")
      }
      return mountNodeRoot(mountedNodes[0]!)
    },
    updateProps(nextProps: P) {
      if (disposed) {
        if (__DEV__) {
          throw new KiruError({
            message: "[kiru/dom]: cannot updateProps on disposed component",
          })
        }
        return
      }
      renderProps = nextProps
      resolved.instance.syncProps(nextProps)
      patchTemplate()
    },
    dispose() {
      if (disposed) {
        if (__DEV__) {
          throw new KiruError({
            message: "[kiru/dom]: component already disposed",
          })
        }
        return
      }
      disposed = true
      disposeRenderNodes()
      const root: DomRoot | null =
        mountedNodes.length > 0
          ? (mountNodeRoot(mountedNodes[0]!) as DomRoot)
          : null
      if (
        mountAnchor?.parentNode &&
        root != null &&
        mountAnchor !== (root as unknown as Comment)
      ) {
        mountAnchor.remove()
        mountAnchor = undefined
      } else if (
        root != null &&
        root.isConnected &&
        root.nodeType !== Node.COMMENT_NODE
      ) {
        root.remove()
      }
      resolved.instance.dispose()
      disposeOwner(setupOwner)
    },
  }

  return handle
}

export function isComponentHandle(value: unknown): value is ComponentHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof (value as ComponentHandle).dispose === "function"
  )
}
