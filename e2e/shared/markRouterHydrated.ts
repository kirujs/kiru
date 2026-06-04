export function markRouterHydrated(container: HTMLElement): void {
  container.dataset.kiruHydratedAt = String(performance.now())
}
