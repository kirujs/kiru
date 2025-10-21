import { ElementProps, unwrap, useMemo, useState } from "kiru"
import { useSettings } from "./Settings"
import { ChevronIcon } from "./icons"
import { className as cls } from "./utils"

const noop = Object.freeze(() => {})

type ValueEditorProps = {
  data: Record<string, unknown>
  onChange: (keys: string[], value: unknown) => void
  mutable: boolean
  objectRefAcc: unknown[]
  keys?: string[]
  className?: ElementProps<"div">["className"]
  border?: boolean
}

export function ValueEditor({
  data,
  onChange,
  mutable,
  objectRefAcc,
  keys = [],
  className,
  border = true,
}: ValueEditorProps) {
  const {
    userSettings: { objectKeysChunkSize },
  } = useSettings()
  const [page, setPage] = useState(0)
  const objectKeys = useMemo(() => {
    return Object.keys(data).slice(0, (page + 1) * objectKeysChunkSize)
  }, [page, objectKeysChunkSize, data])

  const handleShowMore = () => {
    objectKeys.forEach((key) => {
      typeof data[key] === "object" &&
        objectRefAcc.splice(objectRefAcc.indexOf(data[key]), 1)
    })
    setPage(page + 1)
  }

  const showShowMoreButton = objectKeys.length < Object.keys(data).length

  return (
    <>
      <div
        className={cls(
          "flex flex-col items-start w-full",
          border && "border border-neutral-700",
          unwrap(className)
        )}
      >
        {objectKeys.map((key) => {
          const _keys = keys.concat(key)
          const path = _keys.join(".")
          return (
            <div
              key={path}
              data-key={path}
              className="flex flex-col items-start w-full gap-2 pl-2 py-1 pr-1 border-b border-neutral-700 last:border-b-0"
            >
              <ValueFieldEditor
                value={data[key]}
                onChange={onChange}
                keys={_keys}
                path={path}
                label={key}
                mutable={mutable}
                objectRefAcc={objectRefAcc}
              />
            </div>
          )
        })}
      </div>
      {showShowMoreButton && (
        <button
          onclick={handleShowMore}
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

function recurseApply(
  value: Record<string, any> | Array<any>,
  callback: (value: Record<string, any> | Array<any>) => void
) {
  if (Array.isArray(value)) {
    callback(value)
    value.forEach((v) => recurseApply(v, callback))
  } else if (typeof value === "object" && value !== null) {
    callback(value)
    Object.values(value).forEach((v) => recurseApply(v, callback))
  }
}

function ValueFieldEditor({
  value,
  onChange,
  keys,
  path,
  mutable,
  objectRefAcc,
  label,
}: {
  value: unknown
  onChange: (keys: string[], value: unknown) => void
  keys: string[]
  path: string
  mutable: boolean
  objectRefAcc: unknown[]
  label?: string
}) {
  const {
    userSettings: { arrayChunkSize: maxArrayChunkSize },
  } = useSettings()
  const [collapsed, setCollapsed] = useState(true)
  const Label = label !== undefined && (
    <label
      htmlFor={path}
      className="text-xs truncate"
      title={path}
      children={label}
    />
  )

  if (value === null) {
    return (
      <ObjectPropertyWrapper>
        {Label}
        <TextValueDisplay>null</TextValueDisplay>
      </ObjectPropertyWrapper>
    )
  } else if (value === undefined) {
    return (
      <ObjectPropertyWrapper>
        {Label}
        <TextValueDisplay>undefined</TextValueDisplay>
      </ObjectPropertyWrapper>
    )
  }

  const nodeCtor = window.opener ? (window.opener.Node as typeof Node) : Node
  if (value instanceof nodeCtor) {
    return (
      <ObjectPropertyWrapper>
        {Label}
        <TextValueDisplay>
          {"<"}
          <span style={{ color: "#f0a05e" }}>{value.nodeName}</span>
          {"/>"}
        </TextValueDisplay>
      </ObjectPropertyWrapper>
    )
  }

  const errorCtor = window.opener
    ? (window.opener.Error as typeof Error)
    : Error
  if (value instanceof errorCtor) {
    return (
      <ObjectPropertyWrapper>
        {Label}
        {"cause" in value && !!value.cause ? (
          <TextValueDisplay>
            {value.message} ({String(value.cause)})
          </TextValueDisplay>
        ) : (
          <TextValueDisplay>{value.message}</TextValueDisplay>
        )}
      </ObjectPropertyWrapper>
    )
  }

  const handleChange = (newValue: unknown) => onChange(keys, newValue)
  switch (typeof value) {
    case "string":
      return (
        <ObjectPropertyWrapper>
          {Label}
          <ValueInput
            disabled={!mutable}
            id={path}
            type="text"
            value={value}
            onchange={(e) => handleChange(e.target.value)}
          />
        </ObjectPropertyWrapper>
      )
    case "number":
      return (
        <ObjectPropertyWrapper>
          {Label}
          <ValueInput
            disabled={!mutable}
            id={path}
            type="number"
            value={value}
            placeholder="NaN"
            onchange={(e) => handleChange(Number(e.target.value))}
          />
        </ObjectPropertyWrapper>
      )
    case "bigint":
      return (
        <ObjectPropertyWrapper>
          {Label}
          <ValueInput
            disabled={!mutable}
            id={path}
            type="number"
            value={value.toString()}
            onchange={(e) => handleChange(BigInt(e.target.value))}
          />
        </ObjectPropertyWrapper>
      )
    case "boolean":
      return (
        <ObjectPropertyWrapper>
          {Label}
          <input
            disabled={!mutable}
            id={path}
            type="checkbox"
            checked={value}
            onchange={(e) => handleChange(e.target.checked)}
            className="accent-red-500"
          />
        </ObjectPropertyWrapper>
      )
    case "function":
      return (
        <ObjectPropertyWrapper>
          {Label}
          <TextValueDisplay>{`ƒ ${
            value.name || "anonymous"
          }()`}</TextValueDisplay>
        </ObjectPropertyWrapper>
      )
    default:
      if (Array.isArray(value)) {
        return (
          <ObjectPropertyWrapper>
            <button
              className="text-xs flex items-center gap-1 cursor-pointer w-full"
              title={path}
              onclick={() => {
                recurseApply(value, (v) =>
                  objectRefAcc.splice(objectRefAcc.indexOf(v), 1)
                )
                setCollapsed((c) => !c)
              }}
            >
              {label}
              <ChevronIcon
                width={10}
                height={10}
                className={`transition ${collapsed ? "" : "rotate-90"}`}
              />
            </button>
            {collapsed ? (
              <TextValueDisplay>Array({value.length})</TextValueDisplay>
            ) : value.length > maxArrayChunkSize ? (
              <ArrayValueDisplay array={value} objectRefAcc={objectRefAcc} />
            ) : (
              <div className="flex flex-col items-start gap-1 w-full">
                {value.map((item, idx) => (
                  <ValueFieldEditor
                    value={item}
                    onChange={onChange}
                    keys={[...keys, idx.toString()]}
                    path={path.concat(".", idx.toString())}
                    label={idx.toString()}
                    mutable={mutable}
                    objectRefAcc={objectRefAcc}
                  />
                ))}
              </div>
            )}
          </ObjectPropertyWrapper>
        )
      }
      if (objectRefAcc.includes(value)) {
        return (
          <ObjectPropertyWrapper>
            {Label}
            <TextValueDisplay>Object(circular reference)</TextValueDisplay>
          </ObjectPropertyWrapper>
        )
      }
      objectRefAcc.push(value)
      return (
        <ObjectPropertyWrapper>
          <button
            className="text-xs flex items-center gap-1 cursor-pointer w-full"
            title={path}
            onclick={() => {
              recurseApply(value, (v) =>
                objectRefAcc.splice(objectRefAcc.indexOf(v), 1)
              )
              setCollapsed((c) => !c)
            }}
          >
            {label}
            <ChevronIcon
              width={10}
              height={10}
              className={`transition ${collapsed ? "" : "rotate-90"}`}
            />
          </button>
          {collapsed ? null : (
            <ValueEditor
              data={value as Record<string, unknown>}
              onChange={onChange}
              keys={keys}
              mutable={mutable}
              objectRefAcc={objectRefAcc}
            />
          )}
        </ObjectPropertyWrapper>
      )
  }
}

function ObjectPropertyWrapper({ children }: { children: JSX.Element }) {
  return (
    <div className="flex flex-col items-start gap-1 w-full">{children}</div>
  )
}

function ValueInput(props: ElementProps<"input">) {
  return (
    <input
      className="flex-grow text-xs px-2 py-1 text-neutral-300 w-full"
      {...props}
    />
  )
}

function TextValueDisplay({ children }: { children: JSX.Element }) {
  return (
    <small className="text-neutral-300">
      <i>{children}</i>
    </small>
  )
}

function ArrayValueDisplay({
  array,
  objectRefAcc,
}: {
  array: unknown[]
  objectRefAcc: unknown[]
}) {
  const {
    userSettings: { arrayChunkSize: maxArrayChunkSize },
  } = useSettings()
  const len = array.length
  const numChunks = Math.ceil(len / maxArrayChunkSize)
  return (
    <div className="flex flex-col items-start gap-1 w-full">
      {Array.from({ length: numChunks }).map((_, idx) => (
        <ArrayChunkDisplay
          array={array}
          range={{
            start: idx * maxArrayChunkSize,
            end: (idx + 1) * maxArrayChunkSize,
          }}
          objectRefAcc={objectRefAcc}
        />
      ))}
    </div>
  )
}

function ArrayChunkDisplay({
  array,
  range,
  objectRefAcc,
}: {
  array: unknown[]
  range: { start: number; end: number }
  objectRefAcc: unknown[]
}) {
  const [collapsed, setCollapsed] = useState(true)
  let items: unknown[] | undefined

  if (!collapsed) {
    items = array.slice(range.start, range.end)
  } else {
    items = undefined
  }
  return (
    <div className="flex flex-col items-start gap-1 w-full">
      <button
        className="text-xs flex items-center gap-1 cursor-pointer w-full"
        onclick={() => {
          objectRefAcc.splice(objectRefAcc.indexOf(array), 1)
          setCollapsed((c) => !c)
        }}
      >
        [{range.start}..
        {(range.end < array.length ? range.end : array.length) - 1}]
        <ChevronIcon
          width={10}
          height={10}
          className={`transition ${collapsed ? "" : "rotate-90"}`}
        />
      </button>
      {items && (
        <div className="flex flex-col items-start gap-1 w-full">
          {items.map((item, idx) => (
            <ValueFieldEditor
              value={item}
              onChange={noop}
              label={(range.start + idx).toString()}
              keys={[idx.toString()]}
              path={idx.toString()}
              mutable={false}
              objectRefAcc={objectRefAcc}
            />
          ))}
        </div>
      )}
    </div>
  )
}
