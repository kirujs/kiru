import type { DocItemStatus } from "$/docs-meta"

type DocItemStatusProps = {
  status?: DocItemStatus
  hasNewSection?: boolean
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function DocItemStatus({ status, hasNewSection }: DocItemStatusProps) {
  if (status) {
    return (
      <span
        className={`badge ${status.type === "new" ? "" : "badge-warning"} px-1 py-0.5`}
        title={`Since ${status.since}`}
      >
        {capitalizeFirstLetter(status.type)}
      </span>
    )
  }
  return hasNewSection && <span className="badge p-0.5 px-1">Updated</span>
}
