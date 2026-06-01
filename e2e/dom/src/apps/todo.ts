/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function TodoApp() {
 *   const draft = signal("")
 *   const items = signal<TodoItem[]>([])
 *   function addTodo() {
 *     const text = draft().trim()
 *     if (!text) return
 *     items.set([...items(), { id: String(nextId++), text, done: false }])
 *     draft.set("")
 *   }
 *   return () => (
 *     <div data-testid="todo-app">
 *       <form class="todo-form" onsubmit={addTodo}>
 *         <input data-testid="todo-input" bind:value={draft} />
 *         <button type="submit" data-testid="todo-add">Add</button>
 *       </form>
 *       <ul data-testid="todo-list">
 *         <For each={items} key={item => item.id}>
 *           {(item) => (
 *             <li class="todo-row">
 *               // bind:checked on item.done would need a row signal; emit domEffect + on instead:
 *               <input type="checkbox" class="todo-done" checked={item.done} onchange={…} />
 *               <span class="todo-text">{item.text}</span>
 *               <button type="button" class="todo-delete" onclick={…}>Delete</button>
 *             </li>
 *           )}
 *         </For>
 *       </ul>
 *       <p data-testid="todo-count">{items().length} items</p>
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  bindValue,
  clone,
  createComponent,
  domEffect,
  For,
  mount,
  on,
  project,
  signal,
  template,
  type DomAppHandle,
} from "kiru/dom"

type TodoItem = {
  id: string
  text: string
  done: boolean
}

const $t0 = template(`<div data-testid="todo-app">
  <form class="todo-form">
    <input data-testid="todo-input" type="text" placeholder="New todo" />
    <button type="submit" data-testid="todo-add">Add</button>
  </form>
  <ul class="todo-list" data-testid="todo-list"><!--#--></ul>
  <p data-testid="todo-count">0 items</p>
</div>`, 1)

const $t1 = template(`<li class="todo-row">
  <input type="checkbox" class="todo-done" />
  <span class="todo-text"></span>
  <button type="button" class="todo-delete">Delete</button>
</li>`)

let nextId = 1

export function mountTodo(container: HTMLElement): DomAppHandle {
  const items = signal<TodoItem[]>([])
  const draft = signal("")

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    // nodes[0]=form, [1]=input, [2]=add btn, [3]=list ul, [4]=count p
    const form = $n0.nodes[0]!
    const input = $n0.nodes[1] as HTMLInputElement
    const countEl = $n0.nodes[4]!

    bindValue(input, draft)

    function addTodo(e: Event) {
      e.preventDefault()
      const text = draft().trim()
      if (!text) return
      items.set([...items(), { id: String(nextId++), text, done: false }])
      draft.set("")
    }

    on(form, "submit", addTodo)

    domEffect(() => {
      countEl.textContent = `${items().length} items`
    })

    createComponent(
      For,
      {
        each: items,
        key: (item: TodoItem) => item.id,
        children: (item: TodoItem) =>
          createComponent(() => {
            const $el1 = clone($t1)
            const $n1 = project($t1, $el1)
            const checkbox = $n1.nodes[0] as HTMLInputElement
            const textEl = $n1.nodes[1]!
            const deleteBtn = $n1.nodes[2]!

            domEffect(() => {
              const current = items().find((t) => t.id === item.id)
              checkbox.checked = current?.done ?? false
            })
            textEl.textContent = item.text

            on(checkbox, "change", () => {
              items.set(
                items().map((t) =>
                  t.id === item.id ? { ...t, done: checkbox.checked } : t
                )
              )
            })
            on(deleteBtn, "click", () => {
              items.set(items().filter((t) => t.id !== item.id))
            })

            return $el1
          }, {}),
      },
      $n0.anchors[0]!
    )

    return $el0
  }, container)
}
