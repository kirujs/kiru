import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.fileRoutes

export default createViteCypressConfig({ port, hmrPort })
