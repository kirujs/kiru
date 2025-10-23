import { mount } from "kiru"
import { FileRouter } from "kiru/router"
import "./index.css"

mount(
  <FileRouter
    config={{
      baseUrl: "/test",
      dir: "/pages",
      pages: import.meta.glob("/**/index.tsx"),
      layouts: import.meta.glob("/**/layout.tsx"),
      transition: true,
    }}
  />,
  document.getElementById("app")!
)
