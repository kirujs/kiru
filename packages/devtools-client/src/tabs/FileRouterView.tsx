import { kiruGlobal } from "../state"
import type {
  FormattedViteImportMap,
  CurrentPage,
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

const allPages = signal<FormattedViteImportMap>({})
const currentPage = signal<CurrentPage | null>(null)
const currentPageProps = signal<Record<string, unknown>>({})

const sortedPages = computed(() => {
  return Object.keys(allPages.value).sort()
})

const selectedPage = signal<string | null>(null)

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
  const fileRouterDevtools = kiruGlobal.fileRouterInstance?.current?.devtools!
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
            <Derive from={[sortedPages, selectedPage]}>
              {(pages, selected) =>
                pages
                  .filter((page) => keyMatchesFilter(page))
                  .map((page) => (
                    <button
                      onclick={() => (selectedPage.value = page)}
                      className={cls(
                        "flex items-center gap-2 justify-between px-2 py-1 w-full cursor-pointer rounded",
                        "border border-white border-opacity-10 group",
                        page === selected
                          ? " bg-white bg-opacity-5 text-neutral-100"
                          : " hover:[&:not(:group-hover)]:bg-white/10 hover:[&:not(:group-hover)]:text-neutral-100 text-neutral-400"
                      )}
                    >
                      <span className="text-sm">
                        {allPages.value[page].folderPath}
                      </span>
                      <Derive from={[currentPage]}>
                        {(currentPage) =>
                          currentPage?.route === page ? (
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
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 relative">
                              <button
                                className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 hover:bg-white/10 rounded p-1"
                                onclick={(e) => {
                                  e.stopPropagation()
                                  fileRouterDevtools.navigate(page)
                                }}
                              >
                                <SquareArrowRightIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        }
                      </Derive>
                    </button>
                  ))
              }
            </Derive>
          </div>
        </div>
        <div className="flex-grow p-2 sticky top-0">
          <Derive from={selectedPage}>
            {(selectedPage) => selectedPage && <PageView page={selectedPage} />}
          </Derive>
        </div>
      </FiftyFiftySplitter>
    </>
  )

  return (
    <div>
      {/* <h1>File Router</h1>
      <pre>{JSON.stringify(currentPage.value?.route, null, 2)}</pre>
      <ValueEditor
        data={{
          page: currentPage.value,
          props: currentPageProps.value,
        }}
        mutable={false}
        objectRefAcc={[]}
        keys={[]}
        onChange={() => {}}
      />
      <pre>{JSON.stringify(pages.value, null, 2)}</pre> */}
    </div>
  )
}

function PageView({ page }: { page: string }) {
  const fileRouterDevtools = kiruGlobal.fileRouterInstance?.current?.devtools!
  const entries = fileRouterDevtools.getPages()
  const entry = entries[page]
  const modulePromise = usePromise(() => entry.load(), [page])

  return (
    <Suspense data={modulePromise.data} fallback={<div>Loading...</div>}>
      {(module) => (
        <div>
          <h2 className="flex justify-between items-center font-bold mb-2 pb-2 border-b-2 border-neutral-800">
            <div className="flex gap-2 items-center">
              {`<${getNodeName({
                type: module.default as any,
              } as Kiru.VNode)}>`}
              <FileLink fn={module.default} />
            </div>
          </h2>
          {module.config && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Config:</span>
              <ValueEditor
                data={module.config as Record<string, unknown>}
                mutable={false}
                objectRefAcc={[]}
                keys={[]}
                onChange={() => {}}
              />
            </div>
          )}
        </div>
      )}
    </Suspense>
  )
}
