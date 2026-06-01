import type { Signal } from "../signals/base.js"
import type { DomComponentInstance } from "./instance.js"

export interface Owner {
  readonly id: string
  parent: Owner | null
  readonly children: Set<Owner>
  readonly cleanups: Map<string, () => void>
  disposed: boolean
}

export interface DomAppHandle {
  id: number
  name: string
  unmount(): void
}

export interface ComponentHandle<P extends Record<string, unknown> = Record<string, unknown>> {
  readonly owner: Owner
  readonly instance?: DomComponentInstance<P>
  getRoot(): Element | Comment
  updateProps(props: P): void
  dispose(): void
}

/** @deprecated Use ComponentHandle */
export type DomComponentResult = ComponentHandle

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DomMountNode = ComponentHandle<any> | Element

export type DomMountContent = DomMountNode | readonly DomMountNode[]

type DomComponentRender =
  | Element
  | readonly Element[]
  | (() => Element | readonly Element[])

export type DomComponent<P extends Record<string, unknown> = Record<string, unknown>> =
  | ((props: P) => DomComponentRender)
  | (() => ((props: P) => DomComponentRender) | DomComponentRender)

export type DomAnchoredComponent<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
  anchor: Comment
) =>
  | Element
  | Comment
  | readonly (Element | Comment)[]
  | (() => Element | Comment | readonly (Element | Comment)[])

export interface Region {
  mount(content: ComponentHandle | Element): void
  unmount(): void
  readonly current: ComponentHandle | Element | null
}

export type DomForProps<T> = {
  each: (() => readonly T[]) | Signal<readonly T[]>
  children: (item: T, index: number) => DomMountContent
  key?: (item: T, index: number) => string | number
  fallback?: Element | (() => Element)
}
