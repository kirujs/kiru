import { useRouter } from "kiru/router"

export default function HashSectionPage() {
  const router = useRouter()
  return () => (
    <section data-testid="hash-section-page">
      <p data-testid="hash-router">{router.hash() || "(no hash)"}</p>
      <h2 id="section">Section</h2>
    </section>
  )
}
