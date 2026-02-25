import { signal } from "kiru"

export default function RootLayout({ children }: { children: JSX.Children }) {
  const count = signal(0)
  return () => (
    <>
      <header>Header</header>
      <main>{children}</main>
      <button onclick={() => count.value++}>Count: {count.value}</button>
      {1 + 2 + 3 + [1, 2, 3].reduce((a, b) => a + b, 0)}
      <footer>Footer</footer>
    </>
  )
}
