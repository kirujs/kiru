describe("Image (CSR build strategy)", () => {
  const base = () => `http://localhost:${Cypress.env("port")}`

  beforeEach(() => {
    cy.visit(`${base()}/image-demo`)
  })

  it("renders build-time srcset with webp variants (no runtime optimizer)", () => {
    cy.get('[data-testid="image-imported"] img').should(($img) => {
      expect($img.attr("sizes")).to.eq("100vw")
      const srcset = $img.attr("srcset") ?? ""
      expect(srcset).to.match(/\.webp/)
      expect(srcset).to.match(/\d+w/)
      expect(srcset).not.to.match(/_kiru\/image/)
      const src = $img.attr("src") ?? ""
      expect(src).to.match(/\.(webp|jpg|png)/)
      expect($img.attr("width")).to.match(/^\d+$/)
      expect($img.attr("height")).to.match(/^\d+$/)
    })
  })

  it("emits webp variant files on disk", () => {
    cy.readFile("dist/assets/hero-640w.webp", "binary").then((data) => {
      const bytes = String(data)
      expect(bytes.length).to.be.greaterThan(50)
      expect(bytes.slice(0, 4)).to.eq("RIFF")
    })
  })
})
