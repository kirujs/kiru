import { Transition, useEffect } from "kiru"
import { Drawer } from "./dialog/Drawer"
import { useNavDrawer } from "$/state/navDrawer"
import { SITE_LINKS } from "$/constants"
import { LogoIcon } from "./icons/LogoIcon"
import { SidebarContent } from "./SidebarContent"
import { isLinkActive } from "$/utils"
import { ExternalLinkIcon } from "./icons/ExternalLinkIcon"
import { Link, useFileRouter } from "kiru/router"

export function NavDrawer() {
  const {
    value: { open, event },
    setOpen,
  } = useNavDrawer()
  const router = useFileRouter()

  useEffect(() => (open && setOpen(false), void 0), [router.state.pathname])

  return (
    <Transition
      in={open}
      duration={{
        in: 30,
        out: 250,
      }}
      element={(state) =>
        state === "exited" ? null : (
          <Drawer
            side="left"
            state={state}
            close={() => setOpen(false)}
            sender={event}
          >
            <div className="p-4 text-lg">
              <div className="flex gap-1 mb-5">
                <Link to="/" className="flex gap-2 items-center">
                  <LogoIcon width={24} height={24} />
                  <span className="text-primary font-medium">Kiru</span>
                </Link>
              </div>
              <div className="flex flex-col gap-2 px-2 ">
                {SITE_LINKS.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-base font-medium text-muted"
                    >
                      {link.title}
                      <ExternalLinkIcon width={"1rem"} height={"1rem"} />
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`inline-flex items-center gap-1 text-base font-medium ${isLinkActive(link.activePath ?? link.href, router.state.pathname) ? "" : "text-muted"}`}
                    >
                      {link.title}
                    </Link>
                  )
                )}
              </div>
              {router.state.pathname.startsWith("/docs") && (
                <>
                  <hr className="my-6 mx-2 border-white border-opacity-10" />
                  <div className="flex flex-col gap-2 text-base xs:text-base px-2 ">
                    <SidebarContent />
                  </div>
                </>
              )}
            </div>
          </Drawer>
        )
      }
    />
  )
}
