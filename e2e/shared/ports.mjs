/**
 * Fixed local ports per e2e app so builderman can run Cypress suites in parallel.
 * Do not reuse a port — `freeListeningPort` kills listeners on that port (Windows).
 */
export const e2ePorts = {
  csr: { dev: 5173, hmr: 8003 },
  ssg: { hmr: 8030 },
  ssr: { dev: 5192, hmr: 8022, prod: 5193 },
  fileRoutes: { dev: 5175, hmr: 8015 },
  fileRoutesSsr: { dev: 5194, hmr: 8024, prod: 5194 },
  fileRoutesSsg: { dev: 5176, hmr: 8016 },
}
