# Builderman scheduling invariants (kiru)

## Pipeline array order is not sequence

`pipeline([a, b, c])` registers **sibling root tasks**. They run when their explicit `dependencies` are satisfied, not in array order. Use `toTask({ dependencies: [...] })` barriers for waves.

## Artifacts schedule producers

`cache.inputs: [otherTask.artifact("build")]` adds **execution** edges to the producer, not just cache fingerprints. Do not rely on array order when artifacts point at leaf packages.

## Package build waves

| Stage | Builderman task | Waits on |
|-------|-----------------|----------|
| wave1 | `packages:build:wave1` (lib, adapter-contract) | runtime |
| post-wave1 | `packages:build:post-wave1` (wave2 + adapters) | wave1 |
| vite-plugin | `vite-plugin-kiru` build | post-wave1 |

Wave members do **not** use command-level `build.dependencies` on sibling packages; the wave `dependencies` field is the only ordering mechanism (except `lib` → `runtime`, `adapter-bun` → `adapter-node`).

## E2e

- Parent `e2e` depends on `packages:test` only (which transitively requires `packages:build`).
- `e2e:cypress` depends on `packagesForE2e` (alias of `packages:build`).
- Cypress leaves keep `E2ECachConfig` artifacts for cache invalidation; shard-specific deps remain (`ssrBuild`, app `buildTask`, etc.).

## Cold validation

```bash
rm -rf .builderman && pnpm build 2>&1 | tee build.log
```

Expect `Task complete: ...post-wave1` before `Task begin: ...vite-plugin-kiru`, and no `wave2` / `file-routes` begin before `wave1` completes.
