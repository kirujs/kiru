import { KiruImage } from "kiru"

export default function ImageDemo() {
  return () => (
    <main data-testid="image-demo">
      <h1>Image demo</h1>
      <KiruImage
        src="/favicon.ico"
        alt="Favicon"
        width={32}
        height={32}
        loading="eager"
      />
    </main>
  )
}
