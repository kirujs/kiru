export type NodeRange = Kiru.NodeRange

export interface KiruNodeMeta extends Kiru.KiruNode {
  type: Kiru.Element["type"] | "#text" | typeof ROOT_OWNER_TYPE
  component?: KiruNodeMeta
}

export const ROOT_OWNER_TYPE = Symbol.for("kiru.root")

type NodeWithKiruMeta = Node & { __kiru?: KiruNodeMeta }

export function getAttachedNodeMeta(node: Node): KiruNodeMeta | undefined {
  return (node as NodeWithKiruMeta).__kiru
}

export function getNodeMeta(node: Node): KiruNodeMeta | null {
  const meta = getAttachedNodeMeta(node)
  if (!meta) return null
  return meta.component ?? meta
}

export function setNodeMeta(node: Node, meta: KiruNodeMeta): void {
  ;(node as NodeWithKiruMeta).__kiru = meta
}
