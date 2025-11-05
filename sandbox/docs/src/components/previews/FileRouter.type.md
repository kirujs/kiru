```ts
interface PageModule {
  default: Kiru.FC
  config?: PageConfig
}

interface LayoutModule {
  default: Kiru.FC
}

(props: {
  config: {
    dir?: string // default "/pages"
    baseUrl?: string // default "/"
    pages: Record<string, () => Promise<PageModule>>
    layouts: Record<string, () => Promise<LayoutModule>>
    transition?: boolean // enables view transitions for all pages and page loaders
  }
}) => JSX.Element
```
