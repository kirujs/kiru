import { useRouter } from "kiru/router"

export default function HashSectionPage() {
  const router = useRouter()
  return () => (
    <section data-testid="ssg-hash-section">
      <p data-testid="ssg-hash">{router.hash.value || "(no hash)"}</p>
      <h2 id="section">Section</h2>
    </section>
  )
}
