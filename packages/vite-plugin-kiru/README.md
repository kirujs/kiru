# vite-plugin-kiru

Vite plugin for <a href="https://kirujs.dev">Kiru</a> apps that enables HMR, devtools, and SSG with file-based routing & sitemap generation.

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

  // Static Site Generation (SSG) configuration
  ssg: {
    // Base URL for the app
    baseUrl: "/",
    // Directory containing pages
    dir: "./src/pages",
    // Document component filename pattern
    document: "document.{tsx,jsx}",
    // Page component filename pattern
    page: "index.{tsx,jsx}",
    // Layout component filename pattern
    layout: "layout.{tsx,jsx}",
    // Enable view transitions for route changes and page loaders
    transition: true,
    // Build options
    build: {
      // Maximum number of pages to render concurrently
      maxConcurrentRenders: 100,
    },
    // Sitemap generation options
    sitemap: {
      // Domain for sitemap URLs (required)
      domain: "https://example.com",
      // Default last modified date for all URLs
      lastmod: new Date(),
      // Default change frequency (hourly | daily | weekly | monthly | yearly | never)
      changefreq: "weekly", // default: "weekly"
      // Default priority (0.0 to 1.0)
      priority: 0.5, // default: 0.5
      // Per-route overrides
      overrides: {
        "/": {
          changefreq: "daily",
          priority: 0.8,
          lastmod: new Date("2024-01-01"),
          // Images to include for this route
          images: ["/images/hero.png"],
          // Videos to include for this route
          videos: [
            {
              title: "Product Demo",
              thumbnail_loc: "/images/video-thumbnail.png",
              description: "A demonstration of our product features.",
            },
          ],
        },
        "/blog": {
          changefreq: "weekly",
          priority: 0.7,
        },
      },
    },
  },

  // Or, if you want to enable SSG with default configuration:
  ssg: true,
  // (this will not include sitemap generation as it requires manual configuration)
})
```

## Static Site Generation (SSG)

The plugin supports static site generation with configurable sitemap creation. When SSG is enabled, all routes are pre-rendered at build time and a `sitemap.xml` file is generated if configured.

### Sitemap Generation

The sitemap feature generates a `sitemap.xml` file in your build output with all discovered routes (excluding 404 pages).

**Features:**

- Automatic route discovery from your file structure
- Configurable default `changefreq`, `priority`, and `lastmod` for all routes
- Per-route overrides for fine-grained control
- Support for images and videos (Google sitemap extensions)

**Example:**

```ts
ssg: {
  sitemap: {
    domain: "https://kirujs.dev",
    changefreq: "weekly",
    priority: 0.5,
    overrides: {
      "/": {
        changefreq: "daily",
        priority: 0.8,
        images: ["/images/kiru.png"],
      },
    },
  },
}
```

This will generate a `sitemap.xml` file in `dist/client/sitemap.xml` with all your routes properly formatted.

## Features

- **SSG + file-based routing**: Automatic route discovery, static site and sitemap generation
- **HMR**: Hot module replacement for fast development
- **Devtools**: Built-in development tools for debugging
- **TypeScript**: Full TypeScript support with proper type definitions
