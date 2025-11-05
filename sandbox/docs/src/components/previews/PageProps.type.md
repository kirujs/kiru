```ts
type PageProps<T extends PageConfig> = T["loader"] extends PageDataLoaderConfig
  ? AsyncTaskState<
      Awaited<ReturnType<T["loader"]["load"]>>,
      FileRouterDataLoadError
    >
  : {}
```
