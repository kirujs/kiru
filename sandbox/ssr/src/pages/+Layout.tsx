export function Layout({ children }: { children: JSX.Children }) {
  return (
    <div className="min-h-screen flex flex-col gap-20 justify-between px-10 py-20">
      {children}
    </div>
  )
}
