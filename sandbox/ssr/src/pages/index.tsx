import { useRef, useSignal } from "kiru"
import { Head } from "kiru/router"

export default function Page() {
  const count = useSignal(0)
  const countRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation>()

  const handleClick = () => {
    count.value++

    animRef.current?.finish()
    animRef.current = countRef.current?.animate(
      [{ transform: "scale(2.5)" }, { transform: "scale(1)" }],
      {
        duration: 300,
        iterations: 1,
      }
    )
  }

  return (
    <>
      <Head.Content>
        <title>Vite + TS + Kiru</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <button type="button" onclick={handleClick} className="cursor-pointer">
          <img
            src="/favicon.svg"
            className="w-32 h-32 animate-pulse"
            alt="kiru logo"
          />
        </button>
        <span ref={countRef} className="text-4xl font-medium select-none">
          {count}
        </span>
      </div>
    </>
  )
}
