```tsx
import { Portal } from "kiru"

function App() {
  return (
    <div>
      <h1>Hello world!</div>
      <Portal container={() => document.getElementById("portal-root")!}>
        <h2>Hello from the portal!</h2>
      </Portal>
    </div>
  )
}
```
