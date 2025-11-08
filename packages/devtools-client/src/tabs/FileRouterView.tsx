import { kiruGlobal } from "../state"
import type {
  FormattedViteImportMap,
  CurrentPage,
  FormattedViteImportMapEntry,
  DefaultComponentModule,
} from "../../../lib/dist/router/types.internal"
import { computed, Derive, signal, Suspense, useEffect, usePromise } from "kiru"
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

const sortedRoutes = computed(() => {
  return Object.keys(allPages.value).sort()
})

const selectedRoute = signal<string | null>(null)

const filterValue = signal("")
const filterTerms = computed(() =>
  filterValue.value
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 0)
)
function keyMatchesFilter(key: string) {
  return filterTerms.value.every((term) => key.toLowerCase().includes(term))
}

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
            <Derive from={[sortedRoutes, selectedRoute, allPages]}>
              {(routes, selected, allPages) =>
                routes
                  .filter((route) => keyMatchesFilter(route))
                  .map((route) => (
                    <button
                      onclick={() => (selectedRoute.value = route)}
                      className={cls(
                        "flex items-center gap-2 justify-between px-2 py-1 w-full cursor-pointer rounded",
                        "border border-white border-opacity-10 group",
                        route === selected
                          ? " bg-white bg-opacity-5 text-neutral-100"
                          : " hover:[&:not(:group-hover)]:bg-white/10 hover:[&:not(:group-hover)]:text-neutral-100 text-neutral-400"
                      )}
                    >
                      <span className="text-sm">{allPages[route].route}</span>
                      <Derive from={[currentPage]}>
                        {(currentPage) => {
                          const entry = allPages[route]
                          return currentPage?.route === route ? (
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
                                <PageNavigationButton
                                  entry={entry}
                                  route={route}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex invisible items-center gap-2 relative group-hover:visible">
                              <PageNavigationButton
                                entry={entry}
                                route={route}
                              />
                            </div>
                          )
                        }}
                      </Derive>
                    </button>
                  ))
              }
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
  const entry = entries[page]
  const modulePromise = usePromise(() => entry.load(), [page])

  return (
    <Suspense data={modulePromise.data} fallback={<div>Loading...</div>}>
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
    </Suspense>
  )
}
