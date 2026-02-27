import * as kiru from "kiru"
import { ElementProps, unwrap } from "kiru"
import { className as cls } from "kiru/utils"
import { ChevronRightIcon } from "./icons/chevron-right-icon"
import { devtoolsState } from "../state"
import type {
  ViewerArrayChunkNode,
  ViewerArrayNode,
  ViewerLeafNode,
  ViewerNode,
  ViewerObjectNode,
  ViewerRoot,
} from "./value-viewer-data"

type ValueViewerProps = {
  root: ViewerRoot
  className?: ElementProps<"div">["className"]
}

export function ValueViewer({ root, className }: ValueViewerProps) {
  const { objectKeysChunkSize } = devtoolsState.viewerSettings.value
  const page = root.page.value
  const visibleChildren = root.children.slice(
    0,
    (page + 1) * objectKeysChunkSize
  )
  const hasMore = visibleChildren.length < root.children.length

  return (
    <>
      <div
        className={cls("flex flex-col items-start w-full", unwrap(className))}
      >
        {visibleChildren.map((child) => (
          <div
            key={child.path}
            className="flex flex-col items-start w-full gap-2 pl-2 py-1 pr-1 border-b border-neutral-700 last:border-b-0"
          >
            <ViewerNodeView node={child} />
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onclick={() => root.page.value++}
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

// ---------------------------------------------------------------------------
// Per-node renderers
// ---------------------------------------------------------------------------

function ViewerNodeView({ node }: { node: ViewerNode }) {
  switch (node.kind) {
    case "null":
    case "undefined":
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "symbol":
    case "function":
    case "dom-node":
    case "error":
      return <LeafNodeView node={node} />
    case "object":
      return <ObjectNodeView node={node} />
    case "array":
      return <ArrayNodeView node={node} />
    case "array-chunk":
      return <ArrayChunkView node={node} />
  }
}

function LeafNodeView({ node }: { node: ViewerLeafNode }) {
  const { label, path, raw, kind } = node
  const Label = (
    <label htmlFor={path} className="text-xs truncate" title={path}>
      {label}
    </label>
  )

  return (
    <NodeWrapper>
      {Label}
      <LeafValue kind={kind} raw={raw} />
    </NodeWrapper>
  )
}

function LeafValue({
  kind,
  raw,
}: {
  kind: ViewerLeafNode["kind"]
  raw: unknown
}) {
  switch (kind) {
    case "null":
      return <small className="text-neutral-300">null</small>
    case "undefined":
      return <small className="text-neutral-300">undefined</small>
    case "dom-node": {
      const node = raw as Node
      return (
        <small className="text-neutral-300">
          {"<"}
          <span style="color: #f0a05e">{node.nodeName}</span>
          {"/>"}
        </small>
      )
    }
    case "error": {
      const err = raw as Error
      return (
        <small className="text-neutral-300">
          {err.message}
          {"cause" in err && !!err.cause && ` (${String(err.cause)})`}
        </small>
      )
    }
    case "string":
      return <small className="text-neutral-300">{`"${raw}"`}</small>
    case "number":
    case "bigint":
      return (
        <small className="text-neutral-300">{raw as number | bigint}</small>
      )
    case "boolean":
      return (
        <small className="text-neutral-300">
          {(raw as boolean) ? "true" : "false"}
        </small>
      )
    case "symbol":
      return (
        <small className="text-neutral-300">{(raw as symbol).toString()}</small>
      )
    case "function": {
      const fn = raw as Function
      return (
        <small className="text-neutral-300 italic">
          {`ƒ ${fn.name ?? "anonymous"}()`}
        </small>
      )
    }
  }
}

function ObjectNodeView({ node }: { node: ViewerObjectNode }) {
  const isCollapsed = node.collapsed.value

  return (
    <NodeWrapper>
      <button
        className="text-xs flex items-center gap-1 cursor-pointer w-full"
        title={node.path}
        onclick={() => (node.collapsed.value = !node.collapsed.value)}
      >
        {node.label}
        <ChevronRightIcon
          width={10}
          height={10}
          className={`transition ${isCollapsed ? "" : "rotate-90"}`}
        />
      </button>
      {isCollapsed ? null : <ValueViewer root={node} />}
    </NodeWrapper>
  )
}

function ArrayNodeView({ node }: { node: ViewerArrayNode }) {
  const isCollapsed = node.collapsed.value

  return (
    <NodeWrapper>
      <button
        className="text-xs flex items-center gap-1 cursor-pointer w-full"
        title={node.path}
        onclick={() => (node.collapsed.value = !node.collapsed.value)}
      >
        {node.label}
        <ChevronRightIcon
          width={10}
          height={10}
          className={`transition ${isCollapsed ? "" : "rotate-90"}`}
        />
      </button>
      {isCollapsed ? (
        <small className="text-neutral-300">{`Array(${node.length})`}</small>
      ) : (
        <div className="flex flex-col items-start gap-1 w-full">
          {node.children.map((child) => (
            <ViewerNodeView node={child} />
          ))}
        </div>
      )}
    </NodeWrapper>
  )
}

function ArrayChunkView({ node }: { node: ViewerArrayChunkNode }) {
  const isCollapsed = node.collapsed.value

  return (
    <div className="flex flex-col items-start gap-1 w-full">
      <button
        className="text-xs flex items-center gap-1 cursor-pointer w-full"
        onclick={() => (node.collapsed.value = !node.collapsed.value)}
      >
        {node.label}
        <ChevronRightIcon
          width={10}
          height={10}
          className={`transition ${isCollapsed ? "" : "rotate-90"}`}
        />
      </button>
      {!isCollapsed && (
        <div className="flex flex-col items-start gap-1 w-full">
          {node.children.map((child) => (
            <ViewerNodeView node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeWrapper({ children }: { children: JSX.Element }) {
  return (
    <div className="flex flex-col items-start gap-1 w-full">{children}</div>
  )
}
