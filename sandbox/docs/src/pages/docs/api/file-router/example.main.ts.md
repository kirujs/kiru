```jsx
import "./global.css"
import { mount } from "kiru"
import { FileRouter } from "kiru/router"

mount(
  <FileRouter
    config={{
      pages: import.meta.glob("/**/index.{tsx,jsx}"),
      layouts: import.meta.glob("/**/layout.{tsx,jsx}"),
    }}
  />,
  document.getElementById("app")!
)
```
