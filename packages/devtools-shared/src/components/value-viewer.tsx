import * as kiru from "kiru"
import { ElementProps, unwrap } from "kiru"
import { className as cls } from "kiru/utils"
import { ChevronRightIcon } from "./icons/chevron-right-icon"
import { devtoolsState } from "../state"

const { viewerSettings } = devtoolsState

type ValueViewerProps = {
  data: Record<string, unknown>
  path?: string
  className?: ElementProps<"div">["className"]
}

export const ValueViewer: Kiru.FC<ValueViewerProps> = () => {
  const { objectKeysChunkSize } = viewerSettings.value

  const page = kiru.signal(0)
  const objectKeys = kiru.signal<string[]>([])

  return ({ data, className, path = "" }) => {
    const p = page.value
    objectKeys.value = Object.keys(data).slice(0, (p + 1) * objectKeysChunkSize)

    const showNextPageButton =
      objectKeys.value.length < Object.keys(data).length

    return (
      <>
        <div
          className={cls("flex flex-col items-start w-full", unwrap(className))}
        >
          <kiru.For each={objectKeys.value}>
            {(key) => {
              return (
                <div
                  key={path}
                  className="flex flex-col items-start w-full gap-2 pl-2 py-1 pr-1 border-b border-neutral-700 last:border-b-0"
                >
                  <ValueFieldViewer
                    data={data[key]}
                    label={key}
                    path={`${path}.${key}`}
                  />
                </div>
              )
            }}
          </kiru.For>
        </div>
        {showNextPageButton && (
          <button
            onclick={() => page.value++}
            title="Show more"
            className="p-1 border font-bold border-neutral-700 hover:bg-neutral-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1rem"
              height="1rem"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        )}
      </>
    )
  }
}

interface ValueFieldViewerProps {
  data: unknown
  label: string
  path: string
}

const ValueFieldViewer: Kiru.FC<ValueFieldViewerProps> = () => {
  const collapsed = kiru.signal(true)

  return ({ data, label, path }) => {
    const { arrayChunkSize } = viewerSettings.value
    const Label = (
      <label
        htmlFor={path}
        className="text-xs truncate"
        title={path}
        children={label}
      />
    )

    if (data === null) {
      return (
        <ObjectPropertyWrapper>
          {Label}
          <small className="text-neutral-300">null</small>
        </ObjectPropertyWrapper>
      )
    } else if (data === undefined) {
      return (
        <ObjectPropertyWrapper>
          {Label}
          <small className="text-neutral-300">undefined</small>
        </ObjectPropertyWrapper>
      )
    }

    const Node = window.opener
      ? (window.opener.Node as typeof window.Node)
      : window.Node

    if (data instanceof Node) {
      return (
        <ObjectPropertyWrapper>
          {Label}
          <small className="text-neutral-300">
            {"<"}
            <span style="color: #f0a05e">{data.nodeName}</span>
            {"/>"}
          </small>
        </ObjectPropertyWrapper>
      )
    }

    const Error = window.opener
      ? (window.opener.Error as typeof window.Error)
      : window.Error

    if (data instanceof Error) {
      return (
        <ObjectPropertyWrapper>
          {Label}
          <small className="text-neutral-300">
            {data.message}
            {"cause" in data && !!data.cause && ` (${String(data.cause)})`}
          </small>
        </ObjectPropertyWrapper>
      )
    }

    switch (typeof data) {
      case "string":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300">{`"${data}"`}</small>
          </ObjectPropertyWrapper>
        )
      case "number":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300">{data}</small>
          </ObjectPropertyWrapper>
        )
      case "bigint":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300">{data}</small>
          </ObjectPropertyWrapper>
        )
      case "boolean":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300">
              {data ? "true" : "false"}
            </small>
          </ObjectPropertyWrapper>
        )
      case "symbol":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300">{data.toString()}</small>
          </ObjectPropertyWrapper>
        )
      case "function":
        return (
          <ObjectPropertyWrapper>
            {Label}
            <small className="text-neutral-300 italic">
              {`ƒ ${data.name ?? "anonymous"}()`}
            </small>
          </ObjectPropertyWrapper>
        )
      default:
        if (Array.isArray(data)) {
          return (
            <ObjectPropertyWrapper>
              <button
                className="text-xs flex items-center gap-1 cursor-pointer w-full"
                title={path}
                onclick={() => (collapsed.value = !collapsed.value)}
              >
                {label}
                <ChevronRightIcon
                  width={10}
                  height={10}
                  className={`transition ${collapsed.value ? "" : "rotate-90"}`}
                />
              </button>
              <kiru.Derive from={collapsed}>
                {(collapsed) => {
                  if (collapsed) {
                    return (
                      <small className="text-neutral-300">{`Array(${data.length})`}</small>
                    )
                  }
                  if (data.length > arrayChunkSize) {
                    return <ArrayChunksViewer array={data} path={path} />
                  }

                  return (
                    <div className="flex flex-col items-start gap-1 w-full">
                      {data.map((item, idx) => (
                        <ValueFieldViewer
                          data={item}
                          label={idx.toString()}
                          path={`${path}[${idx}]`}
                        />
                      ))}
                    </div>
                  )
                }}
              </kiru.Derive>
            </ObjectPropertyWrapper>
          )
        }
        return (
          <ObjectPropertyWrapper>
            <button
              className="text-xs flex items-center gap-1 cursor-pointer w-full"
              title={path}
              onclick={() => (collapsed.value = !collapsed.value)}
            >
              {label}
              <ChevronRightIcon
                width={10}
                height={10}
                className={`transition ${collapsed.value ? "" : "rotate-90"}`}
              />
            </button>
            {collapsed.value ? null : (
              <ValueViewer data={data as Record<string, unknown>} path={path} />
            )}
          </ObjectPropertyWrapper>
        )
    }

    return null
  }
}

function ObjectPropertyWrapper({ children }: { children: JSX.Element }) {
  return (
    <div className="flex flex-col items-start gap-1 w-full">{children}</div>
  )
}

function ArrayChunksViewer({
  array,
  path,
}: {
  array: unknown[]
  path: string
}) {
  const { arrayChunkSize } = viewerSettings.value

  const len = array.length
  const numChunks = Math.ceil(len / arrayChunkSize)

  return (
    <div className="flex flex-col items-start gap-1 w-full">
      {Array.from({ length: numChunks }).map((_, idx) => (
        <ArrayChunkDisplay
          array={array}
          range={{
            start: idx * arrayChunkSize,
            end: (idx + 1) * arrayChunkSize,
          }}
          path={`${path}[${idx}]`}
        />
      ))}
    </div>
  )
}

interface ArrayChunkDisplayProps {
  array: unknown[]
  range: { start: number; end: number }
  path: string
}

const ArrayChunkDisplay: Kiru.FC<ArrayChunkDisplayProps> = () => {
  const collapsed = kiru.signal(true)

  return ({ array, range, path }) => {
    let items: unknown[] | undefined
    if (!collapsed.value) {
      items = array.slice(range.start, range.end)
    }

    return (
      <div className="flex flex-col items-start gap-1 w-full">
        <button
          className="text-xs flex items-center gap-1 cursor-pointer w-full"
          onclick={() => (collapsed.value = !collapsed.value)}
        >
          {`[${range.start}..${
            range.end < array.length ? range.end : array.length - 1
          }]`}
          <ChevronRightIcon
            width={10}
            height={10}
            className={`transition ${collapsed.value ? "" : "rotate-90"}`}
          />
        </button>
        {items && (
          <div className="flex flex-col items-start gap-1 w-full">
            {items.map((item, idx) => (
              <ValueFieldViewer
                data={item}
                label={(range.start + idx).toString()}
                path={`${path}.${(range.start + idx).toString()}`}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
}
