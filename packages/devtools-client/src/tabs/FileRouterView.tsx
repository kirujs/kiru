import { kiruGlobal } from "../state"
import type {
  FormattedViteImportMap,
  CurrentPage,
  FormattedViteImportMapEntry,
  DefaultComponentModule,
} from "../../../lib/dist/router/types.internal"
import { computed, Derive, signal, useEffect, usePromise } from "kiru"
import { ValueEditor } from "devtools-shared/src/ValueEditor"
import {
  RefreshIcon,
  SquareArrowRightIcon,
  TriangleAlertIcon,
} from "devtools-shared/src/icons"
import { FileLink, Filter, getNodeName } from "devtools-shared"
import { FiftyFiftySplitter } from "../components/FiftyFiftySplitter"
import { className as cls } from "kiru/utils"

const fileRouterDevtools = kiruGlobal.fileRouterInstance?.current?.devtools!

const allPages = signal<FormattedViteImportMap>({})
const currentPage = signal<CurrentPage | null>(null)
const currentPageProps = signal<Record<string, unknown>>({})

interface RouteTreeNode {
  routeKey: string // The key in the FormattedViteImportMap
  route: string // The route path
  entry: FormattedViteImportMapEntry<DefaultComponentModule>
  children: RouteTreeNode[]
}

function buildRouteTree(pages: FormattedViteImportMap): RouteTreeNode[] {
  const routeMap = new Map<string, RouteTreeNode>()
  const routePathMap = new Map<string, RouteTreeNode>() // Maps path without route groups to nodes
  const rootNodes: RouteTreeNode[] = []

  // Helper to filter out route groups (segments that look like "(this)")
  function filterRouteGroups(segments: string[]): string[] {
    return segments.filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
  }

  // Helper to build route path from segments (excluding route groups)
  function buildRoutePathFromSegments(segments: string[]): string {
    const filtered = filterRouteGroups(segments)
    return "/" + filtered.join("/")
  }

  // First pass: create all nodes
  for (const [routeKey, entry] of Object.entries(pages)) {
    const route = entry.route
    const pathSegments = filterRouteGroups(entry.segments)
    const routePath = buildRoutePathFromSegments(pathSegments)

    const node: RouteTreeNode = {
      routeKey,
      route,
      entry,
      children: [],
    }

    routeMap.set(route, node)
    // Also index by path without route groups for parent lookup
    routePathMap.set(routePath, node)
  }

  // Second pass: build tree structure
  for (const [, entry] of Object.entries(pages)) {
    const route = entry.route
    const segments = entry.segments
    const node = routeMap.get(route)!

    // Filter out route groups to find actual path segments
    const pathSegments = filterRouteGroups(segments)

    // Find parent route (one path segment shorter, ignoring route groups)
    if (pathSegments.length > 1) {
      const parentPathSegments = pathSegments.slice(0, -1)
      const parentRoutePath = buildRoutePathFromSegments(parentPathSegments)
      const parentNode = routePathMap.get(parentRoutePath)

      if (parentNode) {
        parentNode.children.push(node)
      } else {
        // Parent doesn't exist as a route, add to root
        rootNodes.push(node)
      }
    } else {
      // Top-level route
      rootNodes.push(node)
    }
  }

  // Sort nodes and their children recursively
  function sortTree(nodes: RouteTreeNode[]): RouteTreeNode[] {
    return nodes
      .sort((a, b) => a.route.localeCompare(b.route))
      .map((node) => ({
        ...node,
        children: sortTree(node.children),
      }))
  }

  return sortTree(rootNodes)
}

const routeTree = computed(() => buildRouteTree(allPages.value))

const selectedRoute = signal<string | null>(null)

const filterValue = signal("")
const filterTerms = computed(() =>
  filterValue.value
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 0)
)

function routeMatchesFilter(
  route: string,
  entry: FormattedViteImportMapEntry<DefaultComponentModule>
): boolean {
  if (filterTerms.value.length === 0) return true
  const searchText = (route + " " + entry.filePath).toLowerCase()
  return filterTerms.value.every((term) => searchText.includes(term))
}

function filterTree(nodes: RouteTreeNode[]): RouteTreeNode[] {
  return nodes
    .map((node) => {
      const filteredChildren = filterTree(node.children)
      const matches = routeMatchesFilter(node.route, node.entry)

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        }
      }
      return null
    })
    .filter((node): node is RouteTreeNode => node !== null)
}

const filteredRouteTree = computed(() => filterTree(routeTree.value))

export function FileRouterView() {
  useEffect(() => {
    if (!fileRouterDevtools) {
      allPages.value = {}
      currentPage.value = null
      currentPageProps.value = {}
      return
    }
    allPages.value = fileRouterDevtools.getPages()
    console.log(allPages.value)
    const unsub = fileRouterDevtools.subscribe((page, props) => {
      currentPage.value = page
      currentPageProps.value = props
    })
    return () => unsub()
  }, [fileRouterDevtools])

  if (!fileRouterDevtools) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        <TriangleAlertIcon />
        <h2 className="text-lg italic">No file router detected</h2>
      </div>
    )
  }

  return (
    <>
      <FiftyFiftySplitter>
        <div className="flex-grow sticky pr-2 top-0 flex flex-col gap-2">
          <Filter value={filterValue} className="sticky top-0" />
          <div className="flex-grow flex flex-col gap-1 items-start">
            <Derive from={[filteredRouteTree, selectedRoute, currentPage]}>
              {(tree, selected, currentPage) => (
                <RouteTreeNodes
                  nodes={tree}
                  selected={selected}
                  currentPage={currentPage}
                  depth={0}
                />
              )}
            </Derive>
          </div>
        </div>
        <div className="flex-grow p-2 sticky top-0">
          <Derive from={selectedRoute}>
            {(selectedPage) => selectedPage && <PageView page={selectedPage} />}
          </Derive>
        </div>
      </FiftyFiftySplitter>
    </>
  )
}

function RouteTreeNodes({
  nodes,
  selected,
  currentPage,
  depth,
}: {
  nodes: RouteTreeNode[]
  selected: string | null
  currentPage: CurrentPage | null
  depth: number
}) {
  return (
    <>
      {nodes.map((node) => {
        const routeKey = node.routeKey
        const route = node.route
        const entry = node.entry
        const isSelected = routeKey === selected
        const isCurrent = currentPage?.route === route
        const hasChildren = node.children.length > 0

        // For nested routes, show only the last segment (relative path)
        // For top-level routes, show the full path
        // entry.route contains the file-based format like "/users/[id]" or "/users/[...slug]"
        let displayRoute = entry.route
        if (depth > 0) {
          // Split route by "/" and filter out empty strings and route groups
          const routeParts = entry.route.split("/").filter(Boolean)

          if (routeParts.length > 0) {
            displayRoute = "/" + routeParts[routeParts.length - 1]
          }
        }

        return (
          <div
            key={routeKey}
            className={cls("flex-grow", depth > 0 ? "ml-4" : "w-full")}
          >
            <button
              onclick={() => (selectedRoute.value = routeKey)}
              className={cls(
                "flex items-center gap-2 justify-between px-2 py-1 w-full cursor-pointer rounded",
                "border border-white border-opacity-10 group",
                isSelected
                  ? " bg-white bg-opacity-5 text-neutral-100"
                  : " hover:[&:not(:group-hover)]:bg-white/10 hover:[&:not(:group-hover)]:text-neutral-100 text-neutral-400"
              )}
            >
              <span className="text-sm">{displayRoute}</span>
              {isCurrent ? (
                <div className="flex items-center gap-2 relative">
                  <span className="text-xs text-neutral-300 bg-white/15 rounded px-1 py-0.5 font-medium">
                    Current
                  </span>
                  <button
                    className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 hover:bg-white/10 rounded p-1"
                    onclick={(e) => {
                      e.stopPropagation()
                      fileRouterDevtools.reload()
                    }}
                  >
                    <RefreshIcon className="w-4 h-4" />
                  </button>
                  {entry.params.length > 0 && (
                    <PageNavigationButton entry={entry} route={entry.route} />
                  )}
                </div>
              ) : (
                <div className="flex invisible items-center gap-2 relative group-hover:visible">
                  <PageNavigationButton entry={entry} route={entry.route} />
                </div>
              )}
            </button>
            {hasChildren && (
              <div className="mt-1 flex flex-col gap-1">
                <RouteTreeNodes
                  nodes={node.children}
                  selected={selected}
                  currentPage={currentPage}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function PageNavigationButton({
  route,
  entry,
}: {
  route: string
  entry: FormattedViteImportMapEntry<DefaultComponentModule>
}) {
  return (
    <button
      className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 hover:bg-white/10 rounded p-1"
      onclick={(e) => {
        e.stopPropagation()
        if (!entry.params.length) {
          return fileRouterDevtools.navigate(route)
        }

        let paramsToUse: Record<string, string> = {}
        for (let i = 0; i < entry.params.length; i++) {
          const param = entry.params[i]
          const value = prompt(`Enter value for "${param}"`)
          if (!value) {
            alert("Navigation cancelled")
            return
          }
          paramsToUse[param] = value
        }

        const path = entry.route
          .split("/")
          .filter((part) => !part.startsWith("(") && !part.endsWith(")"))
          .map((part) => {
            if (part.startsWith("[...") && part.endsWith("]")) {
              return paramsToUse[part.slice(4, -1)]
            } else if (part.startsWith("[") && part.endsWith("]")) {
              return paramsToUse[part.slice(1, -1)]
            }
            return part
          })
          .filter(Boolean)
          .join("/")

        fileRouterDevtools.navigate(`/${path}`)
      }}
    >
      <SquareArrowRightIcon className="w-4 h-4" />
    </button>
  )
}

function PageView({ page }: { page: string }) {
  const entries = fileRouterDevtools.getPages()
  const modulePromise = usePromise(() => entries[page].load(), [page])

  return (
    <Derive from={modulePromise} fallback={<div>Loading...</div>}>
      {({ default: fn, config }) => {
        const n = { type: fn } as any as Kiru.VNode
        return (
          <div>
            <h2 className="flex justify-between items-center font-bold mb-2 pb-2 border-b-2 border-neutral-800">
              <div className="flex gap-2 items-center">
                {`<${getNodeName(n)}>`}
                <FileLink fn={fn} />
              </div>
            </h2>
            {config ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">Config:</span>
                <ValueEditor
                  data={config as Record<string, unknown>}
                  mutable={false}
                  objectRefAcc={[]}
                  keys={[]}
                  onChange={() => {}}
                />
              </div>
            ) : (
              <i className="text-sm text-neutral-400">No config</i>
            )}
          </div>
        )
      }}
    </Derive>
  )
}
