import { useCommandPallete } from "$/state/commandPallete"
import { computed, For, signal, Transition, useEffect, useRef } from "kiru"
import { Modal } from "./dialog/Modal"
import { DialogHeader } from "./dialog/DialogHeader"
import { Input } from "./atoms/Input"
import { DocPageLink, docMeta } from "$/docs-meta"
import { DialogBody } from "./dialog/DialogBody"
import { OS, SITE_LINKS } from "$/constants"
import { SearchIcon } from "./icons/SearchIcon"
import { CloseIcon } from "./icons/CloseIcon"
import { isLinkActive } from "$/utils"
import { ExternalLinkIcon } from "./icons/ExternalLinkIcon"
import { DocItemStatus } from "./DocItemStatus"
import { Link, useFileRouter } from "kiru/router"

const groupData: Record<string, DocPageLink[]> = {
  Links: SITE_LINKS,
  API: docMeta.find((d) => d.title === "API")!.pages!,
  Hooks: docMeta.find((d) => d.title === "Hooks")!.pages!,
}

export function CommandPallete() {
  const {
    value: { open, event },
    setOpen,
  } = useCommandPallete()
  const router = useFileRouter()

  const prevActiveElement = useRef<Element | null>(null)

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardEvent)
    return () => {
      document.removeEventListener("keydown", handleKeyboardEvent)
    }
  }, [])

  useEffect(() => (open && setOpen(false), void 0), [router.state.path])

  function focusSender() {
    const el = prevActiveElement.current
    if (el && el instanceof HTMLElement) el.focus()
  }

  function handleKeyboardEvent(e: KeyboardEvent) {
    const isHandled =
      e.key.toLowerCase() === "k" && (OS === "mac" ? e.metaKey : e.ctrlKey)
    if (!isHandled) return

    e.preventDefault()
    const { open } = useCommandPallete.getState()

    if (!open) {
      prevActiveElement.current = document.activeElement
    } else {
      focusSender()
    }

    setOpen(!open)
  }

  return (
    <Transition
      in={open}
      duration={{
        in: 50,
        out: 250,
      }}
      element={(state) =>
        state === "exited" ? null : (
          <Modal
            state={state}
            close={() => {
              if (!event) focusSender()
              setOpen(false)
            }}
            sender={event}
            className="max-w-[min(400px,100vw)]"
          >
            <CommandPalleteDisplay />
          </Modal>
        )
      }
    />
  )
}
const searchInputValue = signal("")
const filteredGroups = computed(() => {
  const terms = searchInputValue.value.toLowerCase().split(" ")
  return Object.entries(groupData).reduce<CommandPalleteGroupProps[]>(
    (acc, [title, items]) => {
      const sectionTitleLower = title.toLowerCase()

      const filtered = items.filter((item) => {
        const defs = [
          sectionTitleLower,
          ...item.title.toLowerCase().split(" "),
          ...(item.keywords ?? []).map((word) => word.toLowerCase()),
        ]
        let matched = 0
        for (let i = 0; i < terms.length; i++) {
          if (defs.some((k) => k.indexOf(terms[i]) > -1)) matched++
        }
        return matched === terms.length
      })

      if (filtered.length) return [...acc, { title, items: filtered }]
      return acc
    },
    []
  )
})

function CommandPalleteDisplay() {
  const { setOpen } = useCommandPallete()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardEvent)
    return () => document.removeEventListener("keydown", handleKeyboardEvent)
  }, [])

  function handleKeyboardEvent(e: KeyboardEvent) {
    const isHandled = e.key.toLowerCase() === "l" && e.ctrlKey
    if (!isHandled) return
    e.preventDefault()
    searchInputRef.current?.focus()
  }

  return (
    <>
      <DialogHeader className="border-b-0 relative">
        <SearchIcon className="absolute top-[calc(50%-.75rem)] left-2 opacity-35" />
        <Input
          type="text"
          placeholder="Search..."
          className="w-full pl-8 bg-black/20 font-normal text-base"
          ref={searchInputRef}
          bind:value={searchInputValue}
        />
        <button
          ariaLabel="Close"
          onclick={() => setOpen(false)}
          className="flex px-2 items-center opacity-35 hover:opacity-100 focus:opacity-100"
        >
          <CloseIcon width="1em" height="1em" />
        </button>
      </DialogHeader>
      <DialogBody className="bg-black/10 border border-white/5 rounded-sm max-h-[400px] overflow-y-auto scroll-py-20">
        <div className="flex flex-col gap-2">
          <For each={filteredGroups}>
            {(group) => <CommandPalleteGroup key={group.title} {...group} />}
          </For>
        </div>
      </DialogBody>
    </>
  )
}

type CommandPalleteGroupProps = {
  title: string
  items: DocPageLink[]
}
function CommandPalleteGroup({ title, items }: CommandPalleteGroupProps) {
  return (
    <div>
      <h4 className="mx-1 font-bold text-sm text-muted">{title}</h4>
      <div className="flex gap-1 flex-col py-2 px-1">
        {items.map((item) => (
          <CommandPalleteItem
            key={item.href}
            item={item}
            external={"external" in item && Boolean(item.external)}
          />
        ))}
      </div>
    </div>
  )
}

function CommandPalleteItem({
  item,
  external,
}: {
  item: DocPageLink
  external?: boolean
}) {
  const { setOpen } = useCommandPallete()
  const router = useFileRouter()

  if (item.disabled) {
    return (
      <a className="w-full text-muted bg-white/1 border border-white/5 p-2 rounded-sm focus:bg-white/5 hover:bg-white/5">
        <span className="w-full flex justify-between items-center text-xs">
          {item.title}
          <span className="badge">Upcoming</span>
        </span>

        <CommandPalleteBadges item={item} />
      </a>
    )
  }

  let hasNewSection = false
  if (item.status?.type !== "new") {
    hasNewSection = !!item.sections?.some((s) => s.isNew)
  }

  return (
    <Link
      className="w-full text-muted bg-white/1 border border-white/5 p-2 rounded-sm focus:bg-white/5 hover:bg-white/5"
      to={item.href}
      onclick={() =>
        isLinkActive(item.href, router.state.path) && setOpen(false)
      }
      target={external ? "_blank" : "_self"}
    >
      <div className="flex items-start justify-between">
        <span className="flex gap-1 items-center text-sm font-light">
          {item.title}{" "}
          {external ? <ExternalLinkIcon width=".85rem" height=".85rem" /> : ""}
        </span>
        <DocItemStatus status={item.status} hasNewSection={hasNewSection} />
      </div>
      <CommandPalleteBadges item={item} />
    </Link>
  )
}

function CommandPalleteBadges({ item }: { item: DocPageLink }) {
  if (!item.keywords) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {item.keywords.map((keyword) => (
        <span key={keyword} className="badge badge-muted">
          {keyword}
        </span>
      ))}
    </div>
  )
}
