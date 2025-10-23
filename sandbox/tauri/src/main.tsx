import "./styles.css"
import { mount } from "kiru"
import { FileRouter } from "kiru/router"

mount(
  <FileRouter
    config={{
      pages: import.meta.glob("/**/index.tsx"),
      layouts: import.meta.glob("/**/layout.tsx"),
    }}
  />,
  document.getElementById("app")!
)
