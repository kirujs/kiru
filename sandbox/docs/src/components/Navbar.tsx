import { LogoIcon } from "./icons/LogoIcon"
import { MenuIcon } from "./icons/MenuIcon"
import { GithubIcon } from "./icons/GithubIcon"
import { CommandKeyIcon } from "./icons/keys/CommandKeyIcon"
import { useNavDrawer } from "$/state/navDrawer"
import { DISCORD_LINK, OS, SITE_LINKS } from "$/constants"
import { isLinkActive } from "$/utils"
import { useCommandPallete } from "$/state/commandPallete"
import { DiscordIcon } from "./icons/DiscordIcon"
import { ExternalLinkIcon } from "./icons/ExternalLinkIcon"
import { SiteLangToggle } from "./SiteLangToggle"
import { useCallback, useLayoutEffect, useSignal } from "kiru"
import { match } from "lit-match"
import { SearchIcon } from "./icons/SearchIcon"
import { Link, useFileRouter } from "kiru/router"

export function Navbar() {
  const { setOpen } = useNavDrawer()
  const router = useFileRouter()

  return (
    <nav className="flex items-center justify-between py-3 gap-2 w-full">
      <div className="flex items-center gap-4 h-full">
        <button
          ariaLabel="Show menu"
          onclick={(e) => setOpen(true, e)}
          type="button"
          className="sm:hidden flex items-center justify-center h-full"
        >
          <MenuIcon />
        </button>

        <Link to="/" className="hidden sm:flex items-center gap-1 h-full">
          <div className="flex items-center justify-center">
            <LogoIcon />
          </div>
          <span className="text-primary font-bold text-xl flex items-center">
            Kiru
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-4 ml-2 h-full text-sm md:text-base">
          {SITE_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                className="text-md flex items-center h-full text-muted hover:text-light"
              >
                <span className="flex items-center">
                  {link.title}
                  <ExternalLinkIcon className="ml-1" />
                </span>
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className={`text-md flex items-center h-full ${
                  isLinkActive(
                    link.activePath ?? link.href,
                    router.state.pathname
                  )
                    ? "text-light"
                    : "text-muted hover:text-light"
                }`}
              >
                <span className="flex items-center">{link.title}</span>
              </Link>
            )
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 h-full">
        <SiteLangToggle />
        <SearchButton />
        <div className="flex items-center gap-3 h-full">
          <a
            href="https://github.com/kirujs/kiru"
            target="_blank"
            ariaLabel="Visit the Kiru repo on GitHub"
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <GithubIcon />
          </a>
          <a
            href={DISCORD_LINK}
            target="_blank"
            ariaLabel="Join the Kiru Discord server"
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <DiscordIcon />
          </a>
        </div>
      </div>
    </nav>
  )
}

function SearchButton() {
  const { setOpen } = useCommandPallete()
  const os = useSignal<null | "mac" | "other">(null)
  useLayoutEffect(() => ((os.value = OS), void 0), [])
  const handleClick = useCallback((e: MouseEvent) => setOpen(true, e), [])
  return (
    <button
      ariaLabel="Search documentation"
      type="button"
      className="flex leading-4 justify-between items-center grow text-left sm:grow-0 min-w-24 sm:min-w-36 pr-4 pl-2 py-2 gap-2 rounded-sm border border-white/10 bg-stone-950 hover:bg-stone-900"
      onclick={handleClick}
    >
      <SearchIcon />
      <span className="text-xs sm:hidden text-muted">Search...</span>
      <span className="hidden sm:flex text-muted">
        <span className="text-xs">Search Docs</span>
      </span>
      <span className="hidden sm:flex items-center gap-0.5 bg-light opacity-85 text-dark px-1 rounded-sm text-[11px] font-mono">
        {match(os.value)
          .with("mac", () => <CommandKeyIcon width="0.7rem" height="0.7rem" />)
          .with("other", () => "Ctrl")
          .else(() => (
            <span innerHTML="&nbsp;&nbsp;&nbsp;&nbsp;" />
          ))}
        <span>{" + "}</span>
        <b>K</b>
      </span>
    </button>
  )
}
