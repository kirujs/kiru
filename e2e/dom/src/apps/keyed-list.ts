/*
 * ── Source (author JSX) ─────────────────────────────────────
 *
 * function Counter({ item }: { item: CounterItem }) {
 *   const count = signal(item.count)
 *   return () => (
 *     <div class="counter-item" data-id={item.id}>
 *       <span class="counter-id">#{item.id}</span>
 *       <span class="counter-value">{count}</span>
 *       <button class="increment" onclick={() => count.set(c => c + 1)}>+</button>
 *       <button class="decrement" onclick={() => count.set(c => c - 1)}>-</button>
 *     </div>
 *   )
 * }
 *
 * function KeyedListPage() {
 *   const items = signal([{ id: 1, count: 0 }, …])
 *   function moveUp(index) { … }
 *   function moveDown(index) { … }
 *   return () => (
 *     <div id="keyed-list">
 *       <For each={items} key={item => item.id}>
 *         {(item, index) => (
 *           <div class="list-item">
 *             <Counter item={item} />
 *             <div class="controls">
 *               <button class="move-up" onclick={() => moveUp(index)}>↑</button>
 *               <button class="move-down" onclick={() => moveDown(index)}>↓</button>
 *             </div>
 *           </div>
 *         )}
 *       </For>
 *     </div>
 *   )
 * }
 *
 * ── Compiler output (emitted) ───────────────────────────────
 */

import {
  clone,
  createComponent,
  domEffect,
  For,
  mount,
  mountBefore,
  on,
  project,
  signal,
  template,
  type ComponentHandle,
  type DomAppHandle,
} from "kiru/dom"

type CounterItem = {
  id: number
  count: number
}

const $t0 = template(`<div id="keyed-list">
  <div class="keyed-list-inner" style="display: flex; flex-direction: column; gap: 0.5rem;"><!--#--></div>
</div>`, 1)

const $t1 = template(`<div class="counter-item">
  <span class="counter-id"></span>
  <span class="counter-value">0</span>
  <button class="increment" type="button">+</button>
  <button class="decrement" type="button">-</button>
</div>`)

const $t2 = template(`<div class="list-item" style="display: flex; gap: 0.5rem;">
  <!--#-->
  <div class="controls">
    <button class="move-up" type="button">↑</button>
    <button class="move-down" type="button">↓</button>
  </div>
</div>`, 1)

function createKeyedCounter(item: CounterItem): ComponentHandle {
  return createComponent(() => {
    const count = signal(item.count)
    const $el1 = clone($t1)
    $el1.setAttribute("data-id", String(item.id))
    const $n1 = project($t1, $el1)
    // nodes[0]=id span, [1]=value, [2]=increment, [3]=decrement
    const idEl = $n1.nodes[0]!
    const valueEl = $n1.nodes[1]!

    idEl.textContent = `#${item.id}`
    domEffect(() => {
      valueEl.textContent = String(count())
    })
    on($n1.nodes[2]!, "click", () => count.set((c) => c + 1))
    on($n1.nodes[3]!, "click", () => count.set((c) => c - 1))

    return $el1
  }, {})
}

export function mountKeyedList(container: HTMLElement): DomAppHandle {
  const items = signal<CounterItem[]>([
    { id: 1, count: 0 },
    { id: 2, count: 0 },
    { id: 3, count: 0 },
  ])

  function moveUp(id: number) {
    const list = items()
    const index = list.findIndex((item) => item.id === id)
    if (index <= 0) return
    const next = [...list]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    items.set(next)
  }

  function moveDown(id: number) {
    const list = items()
    const index = list.findIndex((item) => item.id === id)
    if (index === -1 || index === list.length - 1) return
    const next = [...list]
    ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
    items.set(next)
  }

  return mount(() => {
    const $el0 = clone($t0)
    const $n0 = project($t0, $el0)
    createComponent(
      For,
      {
        each: items,
        key: (item: CounterItem) => item.id,
        children: (item: CounterItem) =>
          createComponent(() => {
            const $el2 = clone($t2)
            const $n2 = project($t2, $el2)
            const counter = createKeyedCounter(item)
            mountBefore($n2.anchors[0]!, counter)
            // nodes[0]=controls div, [1]=move-up, [2]=move-down
            on($n2.nodes[1]!, "click", () => moveUp(item.id))
            on($n2.nodes[2]!, "click", () => moveDown(item.id))
            return $el2
          }, {}),
      },
      $n0.anchors[0]!
    )

    return $el0
  }, container)
}
