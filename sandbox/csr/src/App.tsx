import {
  useRef,
  useCallback,
  useComputed,
  useSignal,
  signal,
  watch,
  useWatch,
  computed,
} from "kaioken"
import { Router, Route, Link } from "kaioken/router"
import { ROUTES } from "./routes"

function Counter() {
  const count = useSignal(1)
  const countRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation>()

  const handleClick = useCallback(() => {
    count.value++

    animRef.current?.finish()
    animRef.current = countRef.current?.animate(
      [{ transform: "scale(2.5)" }, { transform: "scale(1)" }],
      {
        duration: 300,
        iterations: 1,
      }
    )
  }, [])

  return (
    <div className="flex flex-col gap-8 justify-center items-center">
      <button type="button" onclick={handleClick} className="cursor-pointer ">
        Increment
      </button>
      <span ref={countRef} className="text-4xl font-medium select-none">
        {count}
      </span>
    </div>
  )
}
const count = signal(1)
const triple = computed(() => count.value * 3)
watch(() => console.log("count", count.value))
watch(() => console.log("triple", triple.value))

const Home: Kaioken.FC = () => {
  const double = useComputed(() => count.value * 32)
  useWatch(() => console.log("inner triple b", triple.value))

  return (
    <div>
      <h1>Home </h1>
      <button
        className="bg-primary hover:bg-primary-light text-white font-bold text-sm py-2 px-4 rounded"
        onclick={() => count.value++}
      >
        Count: {count}
        <br />
        Double: {double}
      </button>
      <Counter />
    </div>
  )
}

function Nav() {
  return (
    <nav className=" min-h-screen p-2  mb-5 h-full">
      <div className="sticky top-0 flex flex-col gap-2">
        <Link to={"/"}>Home</Link>
        {Object.entries(ROUTES).map(([path, route]) => (
          <Link key={route.title} to={path}>
            {route.title}
          </Link>
        ))}
        <Link to="/unhandled-route">Unhandled route</Link>
      </div>
    </nav>
  )
}

export function App() {
  return (
    <>
      <Nav />
      <main className="flex items-center justify-center flex-grow w-full">
        <Router>
          <Route path="/" element={<Home />} />
          {Object.entries(ROUTES).map(([path, route]) => (
            <Route
              key={path}
              path={path}
              element={<route.component />}
              fallthrough={route.fallthrough}
            />
          ))}
          <Route path="*" element={<h1>Uh-oh! Page not found :C</h1>} />
        </Router>
      </main>
    </>
  )
}
