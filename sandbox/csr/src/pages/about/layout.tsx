export default function AboutLayout({ children }: { children: any }) {
  return (
    <div className="about-layout">
      <div className="about-sidebar">
        <h2>About Section</h2>
        <ul>
          <li>
            <a href="/about">Overview</a>
          </li>
          <li>
            <a href="/about/team">Team</a>
          </li>
          <li>
            <a href="/about/history">History</a>
          </li>
        </ul>
      </div>
      <div className="about-content">{children}</div>
    </div>
  )
}
