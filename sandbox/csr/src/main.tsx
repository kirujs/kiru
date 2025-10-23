import { mount } from "kiru"
import { FileRouter } from "kiru/router"
import "./index.css"

mount(
  <FileRouter
    config={{
      pages: import.meta.glob("/**/index.tsx"),
      layouts: import.meta.glob("/**/layout.tsx"),
      transition: true,
    }}
  />,
  document.getElementById("app")!
)
