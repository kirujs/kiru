import { Derive, Signal, usePromise } from "kiru"

interface ProductsResponse {
  products: {
    id: number
    title: string
    description: string
    price: number
    discountPercentage: number
    rating: number
    stock: number
    brand: string
    category: string
    thumbnail: string
    images: string[]
  }[]
}

export function Page() {
  const products = usePromise<ProductsResponse>(async (signal) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const response = await fetch("https://dummyjson.com/products", { signal })
    if (!response.ok) throw new Error(response.statusText)
    return await response.json()
  }, [])

  return (
    <Derive from={products} fallback={<div>Loading...</div>}>
      {(data, isStale) => (
        <ul className={isStale ? "opacity-50" : ""}>
          {data.products.map((product) => (
            <li key={product.id}>{product.title}</li>
          ))}
        </ul>
      )}
    </Derive>
  )
}

import { useSignal, useComputed } from "kiru"

function App() {
  const name = useSignal("bob")
  const age = useSignal(42)
  const person = useComputed(() => ({ name: name.value, age: age.value }))

  return (
    <div>
      <input type="number" bind:value={age} />
      <Derive from={person}>
        {(person) => (
          <div>
            {person.name} is {person.age} years old
          </div>
        )}
      </Derive>
      {/* You can also use multiple signals! */}
      <Derive from={{ name, age }}>
        {({ name, age }) => (
          <div>
            {name} is {age} years old
          </div>
        )}
      </Derive>
    </div>
  )
}

interface PersonDisplayProps {
  person: Signal<{
    name: string
    age: number
  }>
}

function PersonDisplay({ person }: PersonDisplayProps) {
  const p = person.value
  return (
    <div>
      {p.name} is {p.age} years old
    </div>
  )
}
