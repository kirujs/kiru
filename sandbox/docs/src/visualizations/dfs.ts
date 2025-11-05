import {
  GraphStep,
  createGraphStep,
  GraphNode,
} from "$/components/GraphVisualizer"

export function createSteps() {
  const steps: GraphStep[] = []
  const s1 = createGraphStep({
    type: "root",
    child: {
      type: "App",
      child: {
        type: "div",
        child: {
          type: "button",
          child: {
            type: "#text",
            props: {
              nodeValue: "Increment",
            },
          },
          sibling: {
            type: "span",
            child: {
              type: "#text",
              props: {
                nodeValue: "Count: ${count}",
              },
            },
            sibling: {
              type: "span",
              child: {
                type: "#text",
                props: {
                  nodeValue: "Count: ${count}",
                },
              },
              sibling: {
                type: "span",
                child: {
                  type: "#text",
                  props: {
                    nodeValue: "Count: ${count}",
                  },
                },
              },
            },
          },
        },
        sibling: {
          type: "div",
        },
      },
    },
  })

  steps.push(s1)

  enum HighlightType {
    Self,
    ToChild,
    ToParent,
    ToSibling,
  }

  const commit = () => {
    const clone = structuredClone(s1)
    steps.push(clone)
  }
  const applyHighlight = (
    node: GraphNode,
    type: HighlightType
  ): (() => void) => {
    switch (type) {
      case HighlightType.Self: {
        const prev = node.props
        node.props = {
          ...prev,
          style: "border: 1px solid red;",
        }
        return () => (node.props = prev)
      }
      case HighlightType.ToChild: {
        node.activeEdges = {
          child: true,
        }
        return () => delete node.activeEdges
      }
      case HighlightType.ToParent: {
        node.activeEdges = {
          parent: true,
        }
        return () => delete node.activeEdges
      }
      case HighlightType.ToSibling: {
        node.activeEdges = {
          sibling: true,
        }
        return () => delete node.activeEdges
      }
    }
  }

  const createHighlightStep = (node: GraphNode, type: HighlightType) => {
    const restore = applyHighlight(node, type)
    commit()
    restore()
  }

  let n = s1.root
  createSteps: while (n) {
    createHighlightStep(n, HighlightType.Self)
    if (n.child) {
      createHighlightStep(n, HighlightType.ToChild)
      n = n.child
      continue
    }

    // right-down-up traversal
    let next = n
    outer: while (next) {
      if (next === s1.root) {
        break createSteps
      }
      if (next.sibling) {
        createHighlightStep(next, HighlightType.ToSibling)
        n = next.sibling
        break outer
      }
      createHighlightStep(next, HighlightType.ToParent)
      next = next.parent!
      createHighlightStep(next, HighlightType.Self)
    }
  }

  return steps
}
