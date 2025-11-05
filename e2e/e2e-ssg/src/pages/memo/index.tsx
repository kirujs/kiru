import { lazy } from "kiru"

const Component = lazy(() => import("./component.tsx"))

export default function MemoTest() {
  return <Component />
}
