describe("Image (SSG build strategy)", () => {
  it("prerenders build-time srcset in HTML", () => {
    cy.readFile("dist/image-demo.html").then((html) => {
      const body = String(html)
      expect(body).to.include('data-testid="image-demo"')
      expect(body).to.match(/srcset="[^"]*\.webp[^"]*\d+w/)
      expect(body).to.match(/width="\d+"/)
      expect(body).to.match(/height="\d+"/)
      expect(body).not.to.include("_kiru/image")
    })
  })

  it("emits kiru-image-manifest.json with variant URLs", () => {
    cy.readFile("dist/kiru-image-manifest.json").then((raw) => {
      const manifest = (
        typeof raw === "string" ? JSON.parse(raw) : raw
      ) as Record<string, Record<string, string>>
      const keys = Object.keys(manifest)
      expect(keys.length).to.be.greaterThan(0)
      expect(keys[0]).to.match(/^@kiru-img:/)
      const first = manifest[keys[0]!]!
      const widths = Object.keys(first)
      expect(widths.length).to.be.greaterThan(0)
      expect(Object.values(first)[0]).to.match(/\/assets\/.*\.webp/)
    })
  })
})
