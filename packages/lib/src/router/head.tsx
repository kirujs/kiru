import type { RouteHeadMeta } from "./types.js"
import { coerceResource, getHeadCollector } from "./headContext.js"
import type { Resource } from "../resource.js"

export type HeadProps<T> =
  | {
      content: RouteHeadMeta
      using?: never
    }
  | {
      using: Resource<T>
      content: (value: T) => RouteHeadMeta
    }

/**
 * Declaratively contribute document metadata for SSR/SSG.
 *
 * - When `content` is an object, it is merged immediately.
 * - When `using` is provided (a `resource()`), metadata is derived from the
 *   resolved resource value and is awaited before SSR streaming begins.
 */
export function Head<T = unknown>(props: HeadProps<T>): null {
  const collector = getHeadCollector()
  if (!collector) return null

  if ("using" in props && props.using !== undefined) {
    const res = coerceResource<T>(props.using)
    if (!res) return null
    collector.using(res, props.content)
    return null
  }

  collector.merge(props.content as RouteHeadMeta)
  return null
}
