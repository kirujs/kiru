import Counter from "$/components/Counter"
import { PageTitle } from "$/components/PageTitle"
import { computed, signal, useComputed, useEffect, useSignal } from "kiru"

export { Page }

const id = signal(23)

function Page() {
  const divId = useComputed(() => `counter-${id}`, "divId")
  useEffect(() => {
    const interval = setInterval(() => (id.value += 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div id={divId} className="w-full h-full flex items-center justify-center">
      <div>
        <PageTitle>Counter</PageTitle>
        <br />
        <Counter />
      </div>
    </div>
  )
}
