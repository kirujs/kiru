import { Experimental_HydrationBoundary } from "kiru/ssr"
import Counter from "./Counter"
import { createContext, Derive, For, useSignal } from "kiru"
import ElementBindingsExample from "shared/src/ElementBindingsExample"
import WebComponentExample from "shared/src/WebComponentExample"
import StoreExample from "shared/src/StoreExample"
import { Num } from "./test"

const test = {
  ThemeContext: createContext<"light" | "dark">("dark"),
}

const foo = {
  bar: 123,
}

const a = () => 123
export function Page() {
  const greeting = useSignal("Hello world!")
  const items = useSignal([1, 2, 3])
  const toggled = useSignal(true)
  /**
   * todo: the 'a' function is being passed and called inside the generated component.
   * need to ensure it is called at the top level instead.
   */
  const addItem = () => (
    items.value.push(items.value.length + 1),
    items.notify()
  )

  console.log("page render", Num)
  const a = () => 456
  return (
    <>
      <button onclick={() => (toggled.value = !toggled.value)}>toggle</button>
      <Num />
      <Experimental_HydrationBoundary
        mode="interaction"
        events={["pointerdown", "keydown", "focus", "input", "mousemove"]}
      >
        123
        {toggled.value && <Counter />}
      </Experimental_HydrationBoundary>
    </>
  )
}

// export function _Page() {
//   const count = useSignal(0)
//   const greeting = useSignal("Hello world!")
//   const a = () => 456
//   /**
//    * todo: the 'a' function is being passed and called inside the generated component.
//    * need to ensure it is called at the top level instead.
//    */
//   return (
//     <HydrationBoundary mode="lazy">
//       <HydrationBoundaryLoader
//         _props={[
//           a(),
//           true ? count.value : count.value + 2,
//           function () {
//             count.value++
//           },
//         ]}
//       />
//     </HydrationBoundary>
//   )
// }

// // loader
// export default lazy(() => ActualChildren)

// // separate module
// ActualChildren = ({ _props }) => {
//   return (
//     <div className="p-6">
//       <h1>{_props[0]}</h1>
//       <Counter count={_props[1]} onIncrement={_props[2]} />
//     </div>
//   )
// }
