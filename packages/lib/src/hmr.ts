import { $HMR_ACCEPT } from "./constants.js"
import { __DEV__ } from "./env.js"
import { traverseApply } from "./utils/index.js"
import { requestUpdate } from "./scheduler.js"
import { Signal } from "./signals/base.js"
import type { WatchEffect } from "./signals/watch.js"
import type { Store } from "./store.js"
import type { AppContext } from "./appContext.js"

export type HMRAccept<T = {}> = {
  provide: () => T
  inject: (prev: T) => void
  destroy: () => void
}

export type GenericHMRAcceptor<T = {}> = {
  [$HMR_ACCEPT]: HMRAccept<T>
}
type HotVar = Kiru.FC | Store<any, any> | Signal<any> | Kiru.Context<any>

type HotVarDesc = {
  type: string
  value: HotVar
  hooks?: Array<{ name: string; args: string }>
  link: string
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
  unnamedWatchers: Array<WatchEffect>
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
  let tmpUnnamedWatchers: WatchEffect[] = []

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
        unnamedWatchers: [],
      }
      moduleMap.set(filePath, mod)
    } else {
      while (onHmrCallbacks.length) onHmrCallbacks.shift()!()
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
      newEntry.value.__devtoolsFileLink = newEntry.link

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

      if (newEntry.type === "createStore") {
        window.__kiru!.stores!.add(name, newEntry.value as Store<any, any>)
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
        window.__kiru!.apps.forEach((ctx) => {
          traverseApply(ctx.rootNode, (vNode) => {
            if (vNode.type === oldEntry.value) {
              vNode.type = newEntry.value as any
              dirtiedApps.add(ctx)
              vNode.hmrUpdated = true
            }
          })
        })
      }
    }
    dirtiedApps.forEach((ctx) => ctx.rootNode && requestUpdate(ctx.rootNode))
    isModuleReplacementExecution = false

    if (tmpUnnamedWatchers.length) {
      let i = 0
      for (; i < tmpUnnamedWatchers.length; i++) {
        const newWatcher = tmpUnnamedWatchers[i]
        const oldWatcher = currentModuleMemory.unnamedWatchers[i]
        if (oldWatcher) {
          newWatcher[$HMR_ACCEPT]!.inject(oldWatcher[$HMR_ACCEPT]!.provide())
          oldWatcher[$HMR_ACCEPT]!.destroy()
        }
        currentModuleMemory.unnamedWatchers[i] = newWatcher
      }
      for (; i < currentModuleMemory.unnamedWatchers.length; i++) {
        const oldWatcher = currentModuleMemory.unnamedWatchers[i]
        oldWatcher[$HMR_ACCEPT]!.destroy()
      }
      currentModuleMemory.unnamedWatchers.length = tmpUnnamedWatchers.length
      tmpUnnamedWatchers.length = 0
    }

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
    pushWatch(watch: WatchEffect) {
      tmpUnnamedWatchers.push(watch)
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
