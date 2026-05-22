export default function Layout({ children }: { children: JSX.Children }) {
  return <div data-testid="custom-layout">{children}</div>
}
