import { Counter } from "$/components/Counter"

export function Page() {
  return (
    <>
      <h1 className="text-3xl md:text-4xl md:leading-normal font-bold text-center">
        Welcome to your Kiru SSR app!
      </h1>
      <Counter />
    </>
  )
}
