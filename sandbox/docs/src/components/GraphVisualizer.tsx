import { ElementProps, useViewTransition, Signal } from "kiru"
import { className as cls } from "kiru/utils"
import ArrowIcon from "./icons/ArrowIcon"

function mapSiblings(
  node: GraphNode,
  callback: (node: GraphNode, prev?: GraphNode) => JSX.Element
) {
  const res: JSX.Element[] = []
  let prev: GraphNode | undefined
  while (node) {
    res.push(callback(node, prev))
    prev = node
    node = node.sibling!
  }
  return res
}

function createGraphNode(
  input: GraphNodeInput,
  depth: number,
  index: number
): GraphNode {
  const res = {
    ...input,
    depth,
    index,
    child: input.child && createGraphNode(input.child, depth + 1, 0),
    sibling: input.sibling && createGraphNode(input.sibling, depth, index + 1),
  }
  let c = res.child
  while (c) {
    c.parent = res
    c = c.sibling
  }
  return res
}

export function createGraphStep(input: GraphNodeInput): GraphStep {
  return {
    root: createGraphNode(input, 0, 0),
  }
}

type GraphNodeInput = {
  type: string
  props?: ElementProps<"div"> & { nodeValue?: string }
  child?: GraphNodeInput
  sibling?: GraphNodeInput
  activeEdges?: {
    parent?: boolean
    child?: boolean
    sibling?: boolean
  }
}

export type GraphNode = {
  type: string
  parent?: GraphNode
  depth: number
  index: number
  props?: ElementProps<"div"> & { nodeValue?: string }
  child?: GraphNode
  sibling?: GraphNode
  activeEdges?: {
    parent?: boolean
    child?: boolean
    sibling?: boolean
  }
}

export type GraphStep = {
  root: GraphNode
}

type GraphVisualizerProps = {
  steps: GraphStep[]
  step: Signal<number>
}

export function GraphVisualizer({ steps, step }: GraphVisualizerProps) {
  const transition = useViewTransition()
  const data = steps[step.value]

  if (!data) return null
  return <GraphVisualizerNode node={data.root} />
}

type GraphVisualizerNodeProps = {
  node: GraphNode
}
function GraphVisualizerNode({ node }: GraphVisualizerNodeProps) {
  // render from root to bottom
  const { type, activeEdges, props, child, sibling } = node

  return (
    <div className="grid grid-flow-col gap-1">
      <div className="col-span-1 relative">
        {node.depth > 0 && node.index > 0 && (
          <ArrowIcon.Up
            className={cls(
              "absolute top-0 left-0.5 -translate-y-full",
              activeEdges?.parent ? "text-primary" : "text-neutral-400"
            )}
          />
        )}
        <small className="absolute top-0.5 left-0.5 text-[8px] bg-black/50 rounded-sm px-0.5">
          {node.depth}-{node.index}
        </small>
        <div
          className="flex flex-col grow bg-light/5 border border-light/50 rounded-sm p-2"
          {...props}
        >
          {type === "#text" ? (
            <>
              #text
              <small>{props?.nodeValue}</small>
            </>
          ) : (
            `<${type}>`
          )}
        </div>
        {child && (
          <>
            <div className="gap-1 grid grid-flow-col">
              <div className="flex">
                <ArrowIcon.Down
                  className={cls(
                    activeEdges?.child ? "text-primary" : "text-neutral-400"
                  )}
                />
                <ArrowIcon.Up
                  className={cls(
                    child.activeEdges?.parent
                      ? "text-primary"
                      : "text-neutral-400"
                  )}
                />
              </div>
            </div>
            <GraphVisualizerNode node={child} />
          </>
        )}
      </div>
      {node.index === 0 &&
        sibling &&
        mapSiblings(sibling, (node, prev) => (
          <div className="flex col-span-1">
            <ArrowIcon.Right
              className={cls(
                "mt-3",
                prev?.activeEdges?.sibling ||
                  (node === sibling && activeEdges?.sibling)
                  ? "text-primary"
                  : "text-neutral-400"
              )}
            />
            <GraphVisualizerNode node={node} />
          </div>
        ))}
    </div>
  )
}
