import {
  Derive,
  ElementProps,
  Fragment,
  unwrap,
  useEffect,
  useSignal,
} from "kiru"
import { className as cls } from "kiru/utils"
import { docMeta } from "$/docs-meta"
import { useNavDrawer } from "$/state/navDrawer"
import { isLinkActive } from "$/utils"
import { DocItemStatus } from "./DocItemStatus"
import { Link, LinkProps, useFileRouter } from "kiru/router"

export function SidebarContent() {
  const router = useFileRouter()
  const { value: open, setOpen } = useNavDrawer((state) => state.open)
  const hash = useSignal(
    "window" in globalThis ? window.location.hash.substring(1) : ""
  )

  useEffect(() => {
    const onHashChange = () => {
      hash.value = window.location.hash.substring(1)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => {
      window.removeEventListener("hashchange", onHashChange)
    }
  }, [])

  return (
    <>
      {docMeta.map((data) => (
        <div key={data.title} className="px-1 mb-3">
          <Header>
            {data.href ? (
              <Link
                to={data.href}
                onclick={() => open && setOpen(false)}
                className="block"
              >
                {data.title}
              </Link>
            ) : (
              <span>{data.title}</span>
            )}
          </Header>
          {data.pages && (
            <LinkList>
              {data.pages.map((page) => {
                const isActive = isLinkActive(page.href, router.state.pathname)
                let hasNewSection = false
                if (page.status?.type !== "new") {
                  hasNewSection = !!page.sections?.some((s) => s.isNew)
                }

                const Tag = page.sections ? "div" : Fragment

                return (
                  <Tag key={page.href}>
                    {page.disabled ? (
                      <StyledLink to="/" key={page.title}>
                        <span className="opacity-75">{page.title}</span>
                        <span className="badge">Upcoming</span>
                      </StyledLink>
                    ) : (
                      <StyledLink
                        key={page.href}
                        to={page.href}
                        onclick={() =>
                          isLinkActive(page.href, router.state.pathname) &&
                          open &&
                          setOpen(false)
                        }
                        isActive={isActive}
                      >
                        {page.title}
                        <DocItemStatus
                          status={page.status}
                          hasNewSection={hasNewSection}
                        />
                      </StyledLink>
                    )}
                    <Derive from={hash}>
                      {(hash) =>
                        isActive &&
                        page.sections && (
                          <LinkList className="px-2 py-1 my-2 bg-white/5 text-sm rounded border border-white/5">
                            {page.sections.map((section) => (
                              <StyledLink
                                isActive={section.id === hash}
                                key={section.id}
                                to={
                                  page.href +
                                  (section.id ? `#${section.id}` : "")
                                }
                                onclick={() => open && setOpen(false)}
                              >
                                {section.title}
                                {section.isNew && (
                                  <span
                                    className="badge p-0.5 px-1"
                                    title={`Since ${section.isNew.since}`}
                                  >
                                    New
                                  </span>
                                )}
                              </StyledLink>
                            ))}
                          </LinkList>
                        )
                      }
                    </Derive>
                  </Tag>
                )
              })}
            </LinkList>
          )}
          {data.sections && (
            <LinkList>
              {data.sections.map((section) => (
                <StyledLink
                  key={section.id}
                  to={data.href + (section.id ? `#${section.id}` : "")}
                  onclick={() => open && setOpen(false)}
                >
                  {section.title}
                </StyledLink>
              ))}
            </LinkList>
          )}
        </div>
      ))}
    </>
  )
}

function Header({ children }: ElementProps<"div">) {
  return <div className={`font-medium w-full block`}>{children}</div>
}

function LinkList({ className, ...props }: ElementProps<"div">) {
  return (
    <div
      className={cls("flex flex-col w-full gap", unwrap(className))}
      {...props}
    />
  )
}

function StyledLink({
  isActive,
  children,
  ...props
}: LinkProps & { isActive?: boolean }) {
  return (
    <Link
      className={`flex items-center justify-between ${isActive ? "text-light" : "text-muted"}`}
      {...props}
    >
      {children}
    </Link>
  )
}
