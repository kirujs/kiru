import { Image } from "kiru"
import "../imageConfig.js"

export default function ImageDemo() {
  return () => (
    <main data-testid="image-demo">
      <h1>Image demo</h1>
      <div data-testid="image-fixed">
        <Image
          src="/favicon.ico"
          alt="Favicon"
          width={32}
          height={32}
          loading="eager"
        />
      </div>
      <div data-testid="image-responsive">
        <Image
          src="/hero.jpg"
          alt="Hero"
          width={640}
          height={480}
          sizes="100vw"
          priority
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    </main>
  )
}
