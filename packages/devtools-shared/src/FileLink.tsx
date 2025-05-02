import { useMemo } from "kaioken"
import { broadcastChannel } from "./broadcastChannel"
import { ExternalLinkIcon } from "./icons"
import { getFileLink } from "./utils"

type FileLinkProps = {
  fn: Function & { __devtoolsFileLink?: string }
  onclick?: (e: Event) => void
}

export function FileLink({ fn, onclick }: FileLinkProps) {
  const fileLink = useMemo(() => getFileLink(fn), [fn])
  if (!fileLink) return null
  return (
    <a
      className="flex items-center gap-1 text-[10px] opacity-50 hover:opacity-100 transition-opacity"
      href={fileLink}
      onclick={(e) => {
        e.preventDefault()
        broadcastChannel.send({
          type: "open-editor",
          fileLink: fileLink,
        })
        onclick?.(e)
      }}
      //target="_top"
      title="Open in editor"
    >
      Open in editor
      <ExternalLinkIcon width="0.65rem" height="0.65rem" />
    </a>
  )
}
