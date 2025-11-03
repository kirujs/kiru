import { lazy } from "kiru"

const MemoTest = lazy(() => import("./component.tsx"))

export default function MemoPage() {
  return <MemoTest />
}
