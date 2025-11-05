```ts
(props: ElementProps<"a"> & { 
  to: string // the path to navigate to
  prefetchJs?: boolean // whether to prefetch the JS for the page
  replace?: boolean // whether to replace the current history entry
  transition?: boolean // enables view transition for the navigation
}) => JSX.Element
```