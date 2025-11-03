import { __DEV__ } from "../../env.js"

export function onLoadedDev() {
  if (!__DEV__) {
    throw new Error(
      "onLoadedDev should not have been included in production build."
    )
  }
  clean()
}

function clean() {
  let isCleaned = true
  const VITE_ID = "data-vite-dev-id"
  const injectedByVite = [
    ...document.querySelectorAll(`style[${VITE_ID}]`),
  ].map((style) => style.getAttribute(VITE_ID))

  const suffix = "?temp"
  const injectedByKiru = [
    ...document.querySelectorAll(
      `link[rel="stylesheet"][type="text/css"][href$="${suffix}"]`
    ),
  ]

  injectedByKiru.forEach((linkKiru) => {
    const href = linkKiru.getAttribute("href")!
    let filePathAbsoluteUserRootDir = href.slice(0, -suffix.length)
    const prefix = "/@fs/"
    if (filePathAbsoluteUserRootDir.startsWith(prefix))
      filePathAbsoluteUserRootDir = filePathAbsoluteUserRootDir.slice(
        prefix.length
      )

    if (
      injectedByVite.some((filePathAbsoluteFilesystem) =>
        filePathAbsoluteFilesystem!.endsWith(filePathAbsoluteUserRootDir)
      )
    ) {
      linkKiru.remove()
    } else {
      isCleaned = false
    }
  })
  return isCleaned
}

function removeInjectedStyles() {
  let sleep = 2

  function runClean() {
    if (clean()) return

    if (sleep < 1000) {
      sleep *= 2
    }
    setTimeout(runClean, sleep)
  }

  setTimeout(runClean, sleep)
}

removeInjectedStyles()
