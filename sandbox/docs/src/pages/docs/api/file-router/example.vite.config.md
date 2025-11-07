```js
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      ssg: {
        baseUrl: "/",
        dir: "src/pages",
        page: "index.{tsx,jsx}",
        layout: "layout.{tsx,jsx}",
        document: "document.{tsx,jsx}",
        transition: false,
        build: {
          maxConcurrentRenders: 100,
        },
      },
      // or, if you're happy with the default settings, you can just use:
      ssg: true,
    }),
  ],
})
```
