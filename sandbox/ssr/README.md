Welcome to your new Kiru SSR project!

This sandbox demonstrates Server-Side Rendering (SSR) with Kiru and Hono.

## Features Demonstrated

- **Server-Side Rendering**: Pages are rendered on the server at request time
- **Client-Side Hydration**: JavaScript takes over after initial render for interactivity
- **Dynamic Routes**: Support for parameterized routes (e.g., `/dynamic/[id]`)
- **Streaming Responses**: Proper handling of streaming content with Hono
- **CSS Injection**: Automatic CSS collection and injection into server-rendered HTML
- **Hot Module Replacement**: Fast refresh during development

## Pages

- `/` - Home page with interactive counter
- `/todos` - Todo list demonstrating client-side state management
- `/about` - About page showing server render time
- `/dynamic/[id]` - Dynamic route example (try `/dynamic/123`)
- `/streaming` - Streaming response demo with hydration

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

This will generate:

- `dist/server/` - Server bundle with render function
- `dist/client/` - Client bundle for hydration

## Production

After building, you can run the production server:

```bash
node dist/server/entry.js
```

Visit [https://kirujs.dev](https://kirujs.dev) for more information.
