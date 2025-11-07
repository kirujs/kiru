```jsx
import { lazy } from "kiru"

const DefaultExportLazyComponent = lazy(() => import("./MyComponent"))
const NamedExportLazyComponent = lazy(() =>
  import("./MyComponent").then((module) => module.MyComponent)
)

const App = () => (
  <div>
    <DefaultExportLazyComponent fallback={<div>Loading...</div>} />
    <NamedExportLazyComponent fallback={<div>Loading...</div>} />
  </div>
)
```
