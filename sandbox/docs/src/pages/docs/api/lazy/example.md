```jsx
import { lazy } from "kiru"

const DefaultExportedLazyComponent = lazy(() => import("./MyComponent"))
const NamedExportedLazyComponent = lazy(() =>
  import("./MyComponent").then((module) => module.MyComponent)
)

const App = () => (
  <div>
    <DefaultExportedLazyComponent fallback={<div>Loading...</div>} />
    <LazyNamedComponent fallback={<div>Loading...</div>} />
  </div>
)
```
