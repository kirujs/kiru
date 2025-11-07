The `ssg` option in the `kiru` plugin accepts:

- **dir**: Root directory to resolve routes from (defaults to `src/pages`)
- **baseUrl**: Base URL where your app is mounted (defaults to `/`)
- **page**: Glob for page files (defaults to `index.{tsx,jsx}`)
- **layout**: Glob for layout files (defaults to `layout.{tsx,jsx}`)
- **document**: Document file (defaults to `document.{tsx,jsx}`)
- **transition**: Enable view transitions for route changes and page loaders (defaults to `false`)
- **build**: Build settings (defaults to `{ maxConcurrentRenders: 100 }`). This is used to limit the number of concurrent renders during the build process.
