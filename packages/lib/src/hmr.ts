import { $HMR_ACCEPT, $DEV_FILE_LINK } from "./constants.js"
import { getNodeMeta } from "./dom/metadata.js"
import { flushSync, requestUpdate } from "./scheduler.js"
import { Signal } from "./signals/base.js"
import type { Effect } from "./signals/effect.js"

export type HMRAccept<T = {}> = {
  provide: () => T
  inject: (prev: T) => void
  destroy: () => void
}

export type GenericHMRAcceptor<T = {}> = {
  [$HMR_ACCEPT]: HMRAccept<T>
}
type HotVar = Kiru.FC | Signal<any> | Kiru.Context<any>

type HotVarDesc = {
  type: string
  value: HotVar
  hooks?: Array<{ name: string; args: string }>
  link: string
}

let _isHmrUpdate = false
export function isHmrUpdate() {
  return _isHmrUpdate
}

export function isGenericHmrAcceptor(
  thing: unknown
): thing is GenericHMRAcceptor<any> {
  return (
    !!thing &&
    (typeof thing === "object" || typeof thing === "function") &&
    $HMR_ACCEPT in thing &&
    typeof thing[$HMR_ACCEPT] === "object" &&
    !!thing[$HMR_ACCEPT]
  )
}

type ModuleMemory = {
  hotVars: Map<string, HotVarDesc>
  unnamedEffects: Array<Effect>
  hmrCallbacks: Array<() => void>
}

type HotVarRegistrationEntry = {
  type: string
  value: HotVar
  link: string
}

function collectOwnersInRange(root: Kiru.KiruNode): Set<Kiru.KiruNode> {
  const owners = new Set<Kiru.KiruNode>([root])
  const visit = (node: Node) => {
    const meta = getNodeMeta(node)
    if (meta) owners.add(meta)
    node.childNodes.forEach(visit)
  }
  const range = root.range
  if (!range) return owners
  let cursor: Node | null = range.start
  while (cursor) {
    visit(cursor)
    if (cursor === range.end) break
    cursor = cursor.nextSibling
  }
  return owners
}

export function createHmrContext() {
  type FilePath = string
  const moduleMap = new Map<FilePath, ModuleMemory>()
  let currentModuleFilePath: string | null = null
  let currentModuleMemory: ModuleMemory | null = null
  let isModuleReplacementExecution = false
  const isReplacement = () => isModuleReplacementExecution
  let isWaitingForNextEffect = false

  const globalHmrCallbacks: Array<() => void> = []
  const onHmr = (callback: () => void) => {
    if (currentModuleMemory) {
      currentModuleMemory.hmrCallbacks.push(callback)
      return
    }
    globalHmrCallbacks.push(callback)
  }

  const prepare = (filePath: string) => {
    let mod = moduleMap.get(filePath)
    isModuleReplacementExecution = !!mod
    if (!mod) {
      mod = {
        hotVars: new Map(),
        unnamedEffects: [],
        hmrCallbacks: [],
      }
      moduleMap.set(filePath, mod)
    } else {
      while (mod.hmrCallbacks.length) mod.hmrCallbacks.shift()!()
      while (globalHmrCallbacks.length) globalHmrCallbacks.shift()!()
      for (const effect of mod.unnamedEffects) {
        effect.stop()
      }
      mod.unnamedEffects.length = 0
    }

    currentModuleMemory = mod!
    currentModuleFilePath = filePath
  }

  const register = (
    hotVarRegistrationEntries: Record<string, HotVarRegistrationEntry>
  ) => {
    if (currentModuleMemory === null)
      throw new Error("[kiru]: HMR could not register: No active module")

    // TODO: we should call destroy() on unmatched old entries

    let dirtyNodes = new Set<any>()
    for (const [name, newEntry] of Object.entries(hotVarRegistrationEntries)) {
      const oldEntry = currentModuleMemory.hotVars.get(name)

      // @ts-ignore - this is how we tell devtools what file the hotvar is from
      newEntry.value[$DEV_FILE_LINK] = newEntry.link

      if (oldEntry?.value) {
        /**
         * this is how, when the previous value has been stored somewhere else (eg. in a Map, or by Vike),
         * we can trace it to its current version by using latest(value)
         */
        // @ts-ignore
        oldEntry.value.__next = newEntry.value
      }

      currentModuleMemory.hotVars.set(name, newEntry)
      if (!oldEntry) continue
      if (
        isGenericHmrAcceptor(oldEntry.value) &&
        isGenericHmrAcceptor(newEntry.value)
      ) {
        performHmrAccept(
          oldEntry.value[$HMR_ACCEPT],
          newEntry.value[$HMR_ACCEPT]
        )
        continue
      }
      if (oldEntry.type === "component" && newEntry.type === "component") {
        window.__kiru.apps.forEach((app) => {
          collectOwnersInRange(app.root).forEach((ownerNode) => {
            if (ownerNode.type === oldEntry.value) {
              ownerNode.type = newEntry.value as any
              dirtyNodes.add(ownerNode)
            }
          })
        })
      }
    }

    if (dirtyNodes.size) {
      _isHmrUpdate = true
      dirtyNodes.forEach((n) => requestUpdate(n))
      flushSync()
      _isHmrUpdate = false
    }

    isModuleReplacementExecution = false
    currentModuleMemory = null
    currentModuleFilePath = null
  }

  const moduleEffects = {
    registerNext() {
      isWaitingForNextEffect = true
    },
    push(effect: Effect<any>) {
      if (!isWaitingForNextEffect) return
      currentModuleMemory!.unnamedEffects.push(effect)
      isWaitingForNextEffect = false
    },
  }

  return {
    register,
    prepare,
    isReplacement,
    moduleEffects,
    onHmr,
    getCurrentFilePath() {
      return currentModuleFilePath
    },
  }
}

/**
 * Queues a callback to be fired when HMR is triggered. This is a no-op in non-browser environments or in production.
 * - If called during current module evaluation, the callback will be fired the next time the current module is evaluated.
 * - If called at any other time, the callback will be fired the next time HMR is triggered.
 * @see https://kirujs.dev/docs/api/lifecycles#onHmr
 * 
 * ```ts
 * import { onHmr } from "kiru"
 * // start an interval in the module scope
 * const interval = setInterval(() => {...}, 1000)
 * // stop the interval when this file is reloaded
 * onHmr(() => clearInterval(interval))
 ```
 */
export function onHmr(callback: () => void): void {
  if ("window" in globalThis && window.__kiru.HMRContext) {
    window.__kiru.HMRContext.onHmr(callback)
  }
}

export function performHmrAccept<T>(
  oldThing: HMRAccept<T>,
  newThing: HMRAccept<T>
) {
  newThing.inject(oldThing.provide())
  oldThing.destroy()
}
