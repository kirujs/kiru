declare module "virtual:kiru-file-router-manifest" {
  const pages: Record<string, () => Promise<{ default: Kiru.FC }>>
  const layouts: Record<string, () => Promise<{ default: Kiru.FC }>>
  export { pages, layouts }
}
