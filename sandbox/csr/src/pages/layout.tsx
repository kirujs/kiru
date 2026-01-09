import { useState } from "kiru"

export default function RootLayout({ children }: { children: JSX.Children }) {
  const [count, setCount] = useState(0)
  return (
    <>
      <header>Header</header>
      <main>{children}</main>
      <button onclick={() => setCount(count + 1)}>Count: {count}</button>
      {1 + 2 + 3 + [1, 2, 3].reduce((a, b) => a + b, 0)}
      <Foo />
      <footer>Footer</footer>
    </>
  )
}

function Foo() {
  console.log("Foo")
  return <div>foo</div>
}

// const $k0 = _jsx("header", null, "Header"),
//   $k1 = 1 + 2 + 3 + [1, 2, 3].reduce((a, b) => a + b, 0),
//   $k2 = _jsx(Foo, null),
//   $k3 = _jsx("footer", null, "Footer")

// export default function RootLayout({ children }) {
//   const [count, setCount] = useState(0)
//   return /* @__PURE__ */ _jsx(
//     _jsxFragment,
//     null,
//     /* @__PURE__ */ $k0,
//     /* @__PURE__ */ _jsx("main", null, children),
//     /* @__PURE__ */ _jsx(
//       "button",
//       { onclick: () => setCount(count + 1) },
//       "Count: ",
//       count
//     ),
//     $k1,
//     /* @__PURE__ */ $k2,
//     /* @__PURE__ */ $k3
//   )
// }
// function Foo() {
//   console.log("Foo")
//   return "foo"
// }
