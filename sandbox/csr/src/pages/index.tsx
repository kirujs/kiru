import { signal, computed, DevTools, ElementProps, useProps } from "kiru"

const count = signal(0)
const double = computed(() => count.value * 2)
if (import.meta.env.DEV) {
  DevTools.track(count, "count")
  DevTools.track(double, "double")
}

export default function HomePage() {
  return (
    <>
      <button onclick={() => count.value++}>Increment ({count})</button>
      <MyButton initialCount={count.value}>Click me</MyButton>
    </>
  )
}

interface CounterProps extends ElementProps<"button"> {
  initialCount?: number
}
const MyButton: Kiru.FC<CounterProps> = () => {
  const { synced } = useProps<CounterProps>()
  const count = synced((props) => props.initialCount ?? 0)

  const handleClick = () => {
    count.value++
  }

  return ({ children, ...props }) => {
    return (
      <button onclick={(e) => (handleClick(), props.onclick?.(e))} {...props}>
        {children}
        {count}
      </button>
    )
  }
}

// we can also use the component type:
const MyButton2: Kiru.FC<
  ElementProps<"button"> & { initialCount?: number }
> = () => {
  const { synced } = useProps<typeof MyButton2>()
  const count = synced((props) => props.initialCount ?? 0)

  const handleClick = () => {
    count.value++
  }

  return ({ children, ...props }) => {
    return (
      <button onclick={(e) => (handleClick(), props.onclick?.(e))} {...props}>
        {children}
        {count}
      </button>
    )
  }
}
