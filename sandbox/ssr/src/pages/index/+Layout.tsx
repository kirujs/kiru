export function Layout({ children }: { children: JSX.Children }) {
  return (
    <>
      {children}
      <div className="text-center text-stone-200">
        <p>Learn at</p>
        <div className="flex gap-4 text-xl w-full justify-center">
          <a
            href="https://kirujs.dev"
            target="_blank"
            className="font-semibold flex items-center gap-1 w-full justify-end"
          >
            <img className="w-5 h-5" src="/favicon.svg" alt="kiru logo" />
            kirujs.dev
          </a>
          <a
            href="https://vike.dev"
            target="_blank"
            className="font-semibold flex items-center gap-1 w-full justify-start"
          >
            <img className="w-5 h-5" src="/vike.svg" alt="vike logo" />
            vike.dev
          </a>
        </div>
      </div>
    </>
  )
}
