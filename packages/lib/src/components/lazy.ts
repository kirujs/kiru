import { createElement } from "../element.js"
import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import { node, renderMode } from "../globals.js"
import { useContext } from "../hooks/useContext.js"
import { useRef } from "../hooks/useRef.js"
import { useRequestUpdate } from "../hooks/utils.js"
import { hydrationStack } from "../hydration.js"
import { flushSync, nextIdle } from "../scheduler.js"
import {
  HYDRATION_BOUNDARY_MARKER,
  HydrationBoundaryContext,
} from "../ssr/hydrationBoundary.js"
import { noop } from "../utils/index.js"
import type { SomeDom } from "../types.utils"

interface FCModule {
  default: Kiru.FC<any>
}

type LazyImportValue = Kiru.FC<any> | FCModule

type InferLazyImportProps<T extends LazyImportValue> = T extends FCModule
  ? Kiru.InferProps<T["default"]>
  : Kiru.InferProps<T>

interface LazyState {
  fn: string
  promise: Promise<LazyImportValue>
  result: Kiru.FC | null
}

type LazyComponentProps<T extends LazyImportValue> = InferLazyImportProps<T> & {
  fallback?: JSX.Element
}

const lazyCache: Map<string, LazyState> =
  "window" in globalThis
    ? // @ts-ignore - we're shamefully polluting the global scope here and hiding it 🥲
      (window.__KIRU_LAZY_CACHE ??= new Map<string, LazyState>())
    : new Map<string, LazyState>()

function consumeHydrationBoundaryChildren(parentNode: Kiru.VNode): {
  parent: HTMLElement
  childNodes: Node[]
  startIndex: number
} {
  const boundaryStart = hydrationStack.currentChild()
  if (
    boundaryStart?.nodeType !== Node.COMMENT_NODE ||
    boundaryStart.nodeValue !== HYDRATION_BOUNDARY_MARKER
  ) {
    throw new KiruError({
      message: "Invalid HydrationBoundary node. This is likely a bug in Kiru.",
      fatal: true,
      vNode: parentNode,
    })
  }
  const parent = boundaryStart.parentElement!
  const childNodes: Node[] = []
  const isBoundaryEnd = (n: Node) => {
    return (
      n.nodeType === Node.COMMENT_NODE &&
      n.nodeValue === "/" + HYDRATION_BOUNDARY_MARKER
    )
  }
  let n = boundaryStart.nextSibling
  boundaryStart.remove()
  const startIndex =
    hydrationStack.childIdxStack[hydrationStack.childIdxStack.length - 1]
  while (n && !isBoundaryEnd(n)) {
    childNodes.push(n)
    hydrationStack.bumpChildIndex()
    n = n.nextSibling
  }
  const boundaryEnd = hydrationStack.currentChild()
  if (!isBoundaryEnd(boundaryEnd)) {
    throw new KiruError({
      message: "Invalid HydrationBoundary node. This is likely a bug in Kiru.",
      fatal: true,
      vNode: parentNode,
    })
  }
  boundaryEnd.remove()
  return { parent, childNodes, startIndex }
}

export function lazy<T extends LazyImportValue>(
  componentPromiseFn: () => Promise<T>
): Kiru.FC<LazyComponentProps<T>> {
  function LazyComponent(props: LazyComponentProps<T>) {
    const { fallback = null, ...rest } = props
    const hydrationCtx = useContext(HydrationBoundaryContext, false)
    const needsHydration = useRef(
      hydrationCtx && renderMode.current === "hydrate"
    )
    const abortHydration = useRef(noop)
    const requestUpdate = useRequestUpdate()
    if (renderMode.current === "string" || renderMode.current === "stream") {
      return fallback
    }

    const fn = componentPromiseFn.toString()
    const withoutQuery = removeQueryString(fn)
    const cachedState = lazyCache.get(withoutQuery)
    if (!cachedState || cachedState.fn !== fn) {
      const promise = componentPromiseFn()
      const state: LazyState = {
        fn,
        promise,
        result: null,
      }
      lazyCache.set(withoutQuery, state)

      const ready = promise.then((componentOrModule) => {
        state.result =
          typeof componentOrModule === "function"
            ? componentOrModule
            : componentOrModule.default
      })

      if (!needsHydration.current) {
        ready.then(() => requestUpdate())
        return fallback
      }

      const thisNode = node.current!

      abortHydration.current = () => {
        for (const child of childNodes) {
          if (child instanceof Element) {
            hydrationStack.resetEvents(child)
          }
          child.parentNode?.removeChild(child)
        }
        needsHydration.current = false
        delete thisNode.lastChildDom
      }

      if (__DEV__) {
        window.__kiru?.HMRContext?.onHmr(() => {
          if (needsHydration.current) {
            abortHydration.current()
          }
        })
      }

      const { parent, childNodes, startIndex } =
        consumeHydrationBoundaryChildren(thisNode)

      thisNode.lastChildDom = childNodes[childNodes.length - 1] as SomeDom

      for (const child of childNodes) {
        if (child instanceof Element) {
          hydrationStack.captureEvents(child)
        }
      }
      const hydrate = () => {
        if (needsHydration.current === false) return

        nextIdle(() => {
          delete thisNode.lastChildDom
          needsHydration.current = false
          hydrationStack.push(parent)
          hydrationStack.childIdxStack[
            hydrationStack.childIdxStack.length - 1
          ] = startIndex
          const prev = renderMode.current
          /**
           * must call requestUpdate before setting renderMode
           * to hydrate, otherwise the update will be postponed
           * and flushSync will have no effect
           */
          requestUpdate()
          renderMode.current = "hydrate"
          flushSync()
          renderMode.current = prev
          for (const child of childNodes) {
            if (child instanceof Element) {
              hydrationStack.releaseEvents(child)
            }
          }
        })
      }

      /**
       * once the promise resolves, we need to act according
       * to the HydrationBoundaryContext 'mode'.
       *
       * - with 'eager', we just hydrate the children immediately
       * - with 'lazy', we'll wait for user interaction before hydrating
       */

      if (hydrationCtx.mode === "eager") {
        ready.then(hydrate)
        return null
      }
      const interactionEvents = hydrationCtx.events
      const onInteraction = (e: Event) => {
        const tgt = e.target
        if (
          tgt instanceof Element &&
          childNodes.some((child) => child.contains(tgt))
        ) {
          interactionEvents.forEach((evtName) => {
            window.removeEventListener(evtName, onInteraction)
          })
          ready.then(hydrate)
        }
      }
      interactionEvents.forEach((evtName) => {
        window.addEventListener(evtName, onInteraction)
      })

      return null
    }

    if (cachedState.result === null) {
      cachedState.promise.then(requestUpdate)
      return fallback
    }
    if (needsHydration.current) {
      abortHydration.current()
    }
    return createElement(cachedState.result, rest)
  }
  LazyComponent.displayName = "Kiru.lazy"
  return LazyComponent
}

/**
 * removes the query string from a function - prevents
 * vite-modified imports (eg. () => import("./Counter.tsx?t=123456"))
 * from causing issues
 */
const removeQueryString = (fnStr: string): string =>
  fnStr.replace(
    /import\((["'])([^?"']+)\?[^)"']*\1\)/g,
    (_, quote, path) => `import(${quote}${path}${quote})`
  )
