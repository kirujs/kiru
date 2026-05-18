import { Image } from "kiru"
import hero from "../assets/hero.jpg"

export default function ImageDemo() {
  return () => (
    <main data-testid="image-demo">
      <h1>Image demo (SSG build)</h1>
      <div data-testid="image-imported">
        <Image
          src={hero}
          alt="Hero"
          sizes="100vw"
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    </main>
  )
}
