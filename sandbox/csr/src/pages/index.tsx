import { signal, computed, DevTools, setup } from "kiru"

const count = signal(0)
const double = computed(() => count.value * 2)
if (import.meta.env.DEV) {
  DevTools.track(count, "count")
  DevTools.track(double, "double")
}

const showChild = computed(() => count.value % 2 === 0)

export default function HomePage() {
  const showSibling = signal(false)
  return () => (
    <>
      <button onclick={() => count.value++}>Increment ({count})</button>
      <button onclick={() => (showSibling.value = !showSibling.value)}>
        Show sibling
      </button>
      {showSibling.value && showChild.value ? (
        [<div>Sibling</div>, <Child />]
      ) : showSibling.value ? (
        <div>Sibling</div>
      ) : showChild.value ? (
        <Child />
      ) : null}
    </>
  )
}

const Child: Kiru.FC = () => {
  const { id } = setup()

  return () => (
    <div>
      <p>ID: {id}</p>
    </div>
  )
}
