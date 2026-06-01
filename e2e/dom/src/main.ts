import "./style.css"
import { mountCounter } from "./apps/counter.ts"
import { mountToggle } from "./apps/toggle.ts"
import { mountNested } from "./apps/nested.ts"
import { mountSwap } from "./apps/swap.ts"
import { mountTodo } from "./apps/todo.ts"
import { mountKeyedList } from "./apps/keyed-list.ts"
import { mountInbox } from "./apps/inbox.ts"
import { mountCounter as mountCounterTsx } from "./apps-tsx/counter.tsx"
import { mountToggle as mountToggleTsx } from "./apps-tsx/toggle.tsx"
import { mountNested as mountNestedTsx } from "./apps-tsx/nested.tsx"
import { mountSwap as mountSwapTsx } from "./apps-tsx/swap.tsx"
import { mountTodo as mountTodoTsx } from "./apps-tsx/todo.tsx"
import { mountKeyedList as mountKeyedListTsx } from "./apps-tsx/keyed-list.tsx"
import { mountInbox as mountInboxTsx } from "./apps-tsx/inbox.tsx"
import { mountWorkspace as mountWorkspaceTsx } from "./apps-tsx/workspace.tsx"

const container = document.getElementById("app")
if (!container) {
  throw new Error("#app not found")
}

const app = new URLSearchParams(window.location.search).get("app") ?? "counter"

switch (app) {
  case "counter-tsx":
    mountCounterTsx(container)
    break
  case "toggle-tsx":
    mountToggleTsx(container)
    break
  case "nested-tsx":
    mountNestedTsx(container)
    break
  case "swap-tsx":
    mountSwapTsx(container)
    break
  case "todo-tsx":
    mountTodoTsx(container)
    break
  case "keyed-list-tsx":
    mountKeyedListTsx(container)
    break
  case "inbox-tsx":
    mountInboxTsx(container)
    break
  case "workspace-tsx":
    mountWorkspaceTsx(container)
    break
  case "toggle":
    mountToggle(container)
    break
  case "nested":
    mountNested(container)
    break
  case "swap":
    mountSwap(container)
    break
  case "todo":
    mountTodo(container)
    break
  case "keyed-list":
    mountKeyedList(container)
    break
  case "inbox":
    mountInbox(container)
    break
  case "counter":
  default:
    mountCounter(container)
    break
}
