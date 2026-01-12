import { __DEV__ } from "../env.js"
import { $HMR_ACCEPT } from "../constants.js"
import { depsRequireChange, useHook } from "../hooks/utils.js"
import { call, latest } from "../utils/index.js"
import { effectQueue, signalSubsMap } from "./globals.js"
import { executeWithTracking } from "./effect.js"
import { Signal } from "./base.js"
import type { HMRAccept } from "../hmr.js"

export class ComputedSignal<T> extends Signal<T> {
  protected $getter: (prev?: T) => T
  protected $unsubs: Map<string, Function>
  protected $isDirty: boolean
  constructor(getter: (prev?: T) => T, displayName?: string) {
    super(void 0 as T, displayName)
    this.$getter = getter
    this.$unsubs = new Map()
    this.$isDirty = true

    if (__DEV__) {
      const inject = this[$HMR_ACCEPT]!.inject!
      // @ts-expect-error this is fine 😅
      this[$HMR_ACCEPT] = {
        provide: () => {
          return this
        },
        inject: (prev) => {
          inject(prev)
          ComputedSignal.stop(prev)
          this.$isDirty = prev.$isDirty
        },
        destroy: () => {},
      } satisfies HMRAccept<ComputedSignal<T>>
    }
  }

  get value() {
    this.ensureNotDirty()
    return super.value
  }

  toString() {
    this.ensureNotDirty()
    return super.toString()
  }

  peek() {
    this.ensureNotDirty()
    return super.peek()
  }

  // @ts-expect-error
  set value(next: T) {}

  subscribe(cb: (state: T, prevState?: T) => void): () => void {
    if (this.$isDirty) {
      ComputedSignal.run(this)
    }
    return super.subscribe(cb)
  }

  static dispose(signal: ComputedSignal<any>): void {
    ComputedSignal.stop(signal)
    Signal.dispose(signal)
  }

  static updateGetter<T>(signal: ComputedSignal<T>, getter: (prev?: T) => T) {
    const $computed = latest(signal)
    $computed.$getter = getter
    $computed.$isDirty = true

    ComputedSignal.run($computed)
    if (Object.is($computed.$value, $computed.$prevValue)) return
    $computed.notify()
  }

  private static stop<T>(computed: ComputedSignal<T>) {
    const { $id, $unsubs } = latest(computed)

    effectQueue.delete($id)
    $unsubs.forEach(call)
    $unsubs.clear()
    computed.$isDirty = true
  }

  private static run<T>(computed: ComputedSignal<T>) {
    const $computed = latest(computed)
    const { $id: id, $getter, $unsubs: subs } = $computed

    const value = executeWithTracking({
      id,
      subs,
      fn: () => $getter($computed.$value),
      onDepChanged: () => {
        $computed.$isDirty = true
        if (__DEV__) {
          if (!signalSubsMap?.get(id)?.size) return
        } else {
          if (!computed.$subs!.size) return
        }
        ComputedSignal.run($computed)
        if (Object.is($computed.$value, $computed.$prevValue)) return
        $computed.notify()
      },
    })
    $computed.sneak(value)
    $computed.$isDirty = false
  }

  private ensureNotDirty() {
    if (!this.$isDirty) return
    if (__DEV__) {
      /**
       * This is a safeguard for dev-mode only, where a 'read' on an
       * already-disposed signal during HMR update => `dom.setSignalProp`
       * would throw due to invalid subs-map access.
       *
       * Perhaps in future we could handle this better by carrying over
       * the previous signal's ID and not disposing it / deleting the
       * map entry.
       */
      if (this.$isDisposed) return
    }
    ComputedSignal.run(this)
  }
}

export function computed<T>(
  getter: (prev?: T) => T,
  displayName?: string
): ComputedSignal<T> {
  return new ComputedSignal(getter, displayName)
}

export function useComputed<T>(
  getter: (prev?: T) => T,
  displayName?: string
): ComputedSignal<T>

export function useComputed<T>(
  getter: (prev?: T) => T,
  deps?: unknown[],
  displayName?: string
): ComputedSignal<T>

export function useComputed<T>(
  getter: (prev?: T) => T,
  depsOrDisplayName?: string | unknown[],
  displayName?: string
) {
  return useHook(
    "useComputedSignal",
    {
      signal: null! as ComputedSignal<T>,
      deps: void 0 as unknown[] | undefined,
    },
    ({ hook, isInit, isHMR }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: {
            get: () => ({
              displayName: hook.signal.displayName,
              value: hook.signal.peek(),
            }),
          },
        }
        if (isHMR) {
          // useComputed is always considered side-effecty, so we need to re-run
          hook.cleanup?.()
          isInit = true
        }
      }
      if (isInit) {
        if (typeof depsOrDisplayName === "string") {
          displayName = depsOrDisplayName
          depsOrDisplayName = void 0
        }
        hook.deps = depsOrDisplayName
        hook.cleanup = () => ComputedSignal.dispose(hook.signal)
        hook.signal = computed(getter, displayName)
      } else if (
        hook.deps &&
        typeof depsOrDisplayName !== "string" &&
        depsRequireChange(hook.deps, depsOrDisplayName)
      ) {
        hook.deps = depsOrDisplayName
        ComputedSignal.updateGetter(hook.signal, getter)
      }

      return hook.signal
    }
  )
}
