import { $HMR_ACCEPT, $DEV_FILE_LINK } from "./constants.js"
import { traverseApply } from "./utils/index.js"
import { flushSync, requestUpdate } from "./scheduler.js"
import { Signal } from "./signals/base.js"
import type { AppContext } from "./appContext.js"
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
}

type HotVarRegistrationEntry = {
  type: string
  value: HotVar
  link: string
}

export function createHMRContext() {
  type FilePath = string
  const moduleMap = new Map<FilePath, ModuleMemory>()
  let currentModuleFilePath: string | null = null
  let currentModuleMemory: ModuleMemory | null = null
  let isModuleReplacementExecution = false
  const isReplacement = () => isModuleReplacementExecution
  let isWaitingForNextWatchCall = false

  const onHmrCallbacks: Array<() => void> = []
  const onHmr = (callback: () => void) => {
    onHmrCallbacks.push(callback)
  }

  const prepare = (filePath: string) => {
    let mod = moduleMap.get(filePath)
    isModuleReplacementExecution = !!mod
    if (!mod) {
      mod = {
        hotVars: new Map(),
        unnamedEffects: [],
      }
      moduleMap.set(filePath, mod)
    } else {
      while (onHmrCallbacks.length) onHmrCallbacks.shift()!()
      for (const prevWatcher of mod.unnamedEffects.splice(0)) {
        prevWatcher.stop()
      }
    }

    currentModuleMemory = mod!
    currentModuleFilePath = filePath
  }

  const register = (
    hotVarRegistrationEntries: Record<string, HotVarRegistrationEntry>
  ) => {
    if (currentModuleMemory === null)
      throw new Error("[kiru]: HMR could not register: No active module")

    let dirtiedApps: Set<AppContext> = new Set()
    for (const [name, newEntry] of Object.entries(hotVarRegistrationEntries)) {
      const oldEntry = currentModuleMemory.hotVars.get(name)

      // @ts-ignore - this is how we tell devtools what file the hotvar is from
      newEntry.value[$DEV_FILE_LINK] = newEntry.link

      if (typeof newEntry.value === "function") {
        if (oldEntry?.value) {
          /**
           * this is how, when the previous function has been stored somewhere else (eg. in a Map, or by Vike),
           * we can trace it to its latest version
           */
          // @ts-ignore
          oldEntry.value.__next = newEntry.value
        }
      }

      currentModuleMemory.hotVars.set(name, newEntry)
      if (!oldEntry) continue
      if (
        isGenericHmrAcceptor(oldEntry.value) &&
        isGenericHmrAcceptor(newEntry.value)
      ) {
        newEntry.value[$HMR_ACCEPT].inject(
          oldEntry.value[$HMR_ACCEPT].provide()
        )
        oldEntry.value[$HMR_ACCEPT].destroy()
        continue
      }
      if (oldEntry.type === "component" && newEntry.type === "component") {
        window.__kiru.apps.forEach((ctx) => {
          traverseApply(ctx.rootNode, (vNode) => {
            if (vNode.type === oldEntry.value) {
              vNode.type = newEntry.value as any
              dirtiedApps.add(ctx)
            }
          })
        })
      }
    }

    if (dirtiedApps.size) {
      _isHmrUpdate = true
      dirtiedApps.forEach((ctx) => requestUpdate(ctx.rootNode))
      flushSync()
      _isHmrUpdate = false
    }

    isModuleReplacementExecution = false
    currentModuleMemory = null
    currentModuleFilePath = null
  }

  const signals = {
    registerNextWatch() {
      isWaitingForNextWatchCall = true
    },
    isWaitingForNextWatchCall() {
      return isWaitingForNextWatchCall
    },
    pushWatch(effect: Effect) {
      currentModuleMemory!.unnamedEffects.push(effect)
      isWaitingForNextWatchCall = false
    },
  }

  return {
    register,
    prepare,
    isReplacement,
    signals,
    onHmr,
    getCurrentFilePath() {
      return currentModuleFilePath
    },
  }
}
