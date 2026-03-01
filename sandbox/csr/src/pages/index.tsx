import {
  Fragment,
  signal,
  Derive,
  computed,
  DevTools,
  ElementProps,
} from "kiru"

const count = signal(0)
const double = computed(() => count.value * 2)
if (import.meta.env.DEV) {
  DevTools.track(count, "count")
  DevTools.track(double, "double")
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <button onclick={() => count.value++}>Parent Count ({count})</button>
      <MyButton initialCount={count.value}>Child Count</MyButton>
    </div>
  )
}

interface MyButtonProps extends ElementProps<"button"> {
  initialCount: number
}

const MyButton: Kiru.FC<MyButtonProps> = ({ initialCount }) => {
  const count = signal(initialCount)

  return (props) => {
    if (props.initialCount !== initialCount) {
      count.value = props.initialCount
      initialCount = props.initialCount
    }
    return (
      <button onclick={() => count.value++}>
        {props.children} {count}
      </button>
    )
  }
}
