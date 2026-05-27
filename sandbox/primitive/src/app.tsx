import { signal } from "kiru"
import { AnotherCounter, Counter } from "./counter"

export function App() {
  const toggled = signal(false)
  return () => (
    <div>
      <h1>Static content</h1>
      <button onclick={() => toggled.set((t) => !t)}>Toggle</button>
      {toggled() && <Counter />}
      <AnotherCounter />
    </div>
  )
}

// export function App() {
//   const toggled = signal(false)
//   const $k0 = jsxDEV(
//     "button",
//     { onclick: () => toggled.set((t) => !t), children: "Toggle" },
//     void 0,
//     false,
//     {
//       fileName: "C:/repos/kiru/kiru/sandbox/primitive/src/app.tsx",
//       lineNumber: 9,
//       columnNumber: 7,
//     },
//     this
//   )
//   return () =>
//     /* @__PURE__ */ createHoledTemplate(
//       $t0,
//       [
//         $k0,
//         () =>
//           toggled() &&
//           /* @__PURE__ */ jsxDEV(
//             Counter,
//             {},
//             void 0,
//             false,
//             {
//               fileName: "C:/repos/kiru/kiru/sandbox/primitive/src/app.tsx",
//               lineNumber: 10,
//               columnNumber: 21,
//             },
//             this
//           ),
//         jsxDEV(
//           AnotherCounter,
//           {},
//           void 0,
//           false,
//           {
//             fileName: "C:/repos/kiru/kiru/sandbox/primitive/src/app.tsx",
//             lineNumber: 11,
//             columnNumber: 7,
//           },
//           this
//         ),
//       ],
//       [
//         { kind: "node", anchor: 0 },
//         { kind: "conditional", anchor: 1 },
//         { kind: "component", anchor: 2 },
//       ]
//     )
// }
