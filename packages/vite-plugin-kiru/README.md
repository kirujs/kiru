# vite-plugin-kiru

Vite plugin for <a href="https://kirujs.dev">Kiru</a> apps that enables HMR, devtools, file-based routing, and SSG/SSR.

## Installation

```bash
npm i -D vite-plugin-kiru
# or
pnpm add -D vite-plugin-kiru
```

## Basic Usage

```ts
// vite.config.ts
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [kiru()],
})
```

## Configuration

```ts
kiru({
  // Enable or disable the Kiru devtools.
  // Defaults to true in development mode.
  devtools: false,

  // Or provide configuration for the devtools client
  devtools: {
    // Path where the devtools client will be served
    pathname: "/devtools", // default: "/__devtools__"
    // Optional - function to format file links that will be displayed in the devtools
    formatFileLink: (path, line) => `vscode://file/${path}:${line}`,
  },

  // Additional directories (relative to root) to include in transforms.
  include: ["../shared/"],

  // Enable logging for debugging
  loggingEnabled: true,

  // App configuration for file-based routing
  app: {
    baseUrl: "/", // Base URL for the app
    dir: "src/pages", // Directory containing pages
    document: "document.{tsx,jsx}", // Document component file
    page: "index.{tsx,jsx}", // Page component pattern
    layout: "layout.{tsx,jsx}", // Layout component pattern
  },

  // Callbacks
  onFileTransformed: (id, content) => {
    console.log(`Transformed: ${id}`)
  },
  onFileExcluded: (id) => {
    console.log(`Excluded: ${id}`)
  },
})
```

## Features

- **File-based routing**: Automatic route generation from your pages directory
- **SSR/SSG**: Server-side rendering and static site generation
- **HMR**: Hot module replacement for fast development
- **Devtools**: Built-in development tools for debugging
- **TypeScript**: Full TypeScript support with proper type definitions

## Architecture

The plugin is organized into focused modules:

- `virtual-modules.ts` - Virtual module generation for routing
- `dev-server.ts` - Development server SSR handling
- `preview-server.ts` - Preview server middleware
- `devtools.ts` - Development tools integration
- `ssg.ts` - Static site generation
- `config.ts` - Configuration management
- `utils.ts` - Shared utilities
