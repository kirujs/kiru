const globResult = import.meta.glob("/**/index.{tsx,jsx}", { base: "./pages" })

interface RouteMapEntry {
  displayName: string
  component: () => Promise<{ default: Kiru.FC }>
}

export const routes: Record<string, RouteMapEntry> = Object.entries(
  globResult
).reduce((acc, [k, v]) => {
  let path = k.substring(1, k.length - 4) // remove "." and ".tsx"
  path = path.substring(0, path.length - 6)
  if (path === "") path = "/"
  return {
    ...acc,
    [path]: {
      displayName: path === "/" ? "home" : path.substring(1),
      component: v,
    },
  }
}, {})

console.log("routes", routes)
