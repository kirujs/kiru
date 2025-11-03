import { lazy } from "kiru"

const SignalsTest = lazy(() => import("./component.tsx"))

export default function SignalsPage() {
  return <SignalsTest />
}
