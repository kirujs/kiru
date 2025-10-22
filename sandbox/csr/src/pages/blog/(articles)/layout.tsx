export default function ArticleLayout({
  children,
}: {
  children: JSX.Children
}) {
  return (
    <>
      <h1>Article Layout</h1>
      {children}
    </>
  )
}
