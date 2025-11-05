/// <reference types="cypress" />
describe("signals", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/signals`)
  })

  describe("rendering", () => {
    it("correctly renders a nullable string signal", () => {
      cy.get("#nullable-string").should("not.have.text", "null")
    })
  })

  describe("Basic Signal Functionality", () => {
    it("should increment and decrement counter signal", () => {
      cy.get("#counter-signal #count-display").should("contain.text", "0")

      // Test increment
      cy.get("#counter-signal #increment").click()
      cy.get("#counter-signal #count-display").should("contain.text", "1")

      // Test multiple increments
      cy.get("#counter-signal #increment").click().click()
      cy.get("#counter-signal #count-display").should("contain.text", "3")

      // Test decrement
      cy.get("#counter-signal #decrement").click()
      cy.get("#counter-signal #count-display").should("contain.text", "2")
    })

    it("should handle string signal with two-way binding", () => {
      // Test initial value
      cy.get("#string-signal #name-input").should("have.value", "World")
      cy.get("#string-signal #greeting").should("contain.text", "Hello, World!")

      // Test two-way binding
      cy.get("#string-signal #name-input").clear().type("Kiru")
      cy.get("#string-signal #name-input").should("have.value", "Kiru")
      cy.get("#string-signal #greeting").should("contain.text", "Hello, Kiru!")
    })
  })

  describe("Computed Signals", () => {
    it("should automatically update computed values when inputs change", () => {
      // Check initial computed values (10 * 5 = 50, perimeter = 30, price = 5000)
      cy.get("#computed-results #area-result").should(
        "contain.text",
        "50 sq units"
      )
      cy.get("#computed-results #perimeter-result").should(
        "contain.text",
        "30 units"
      )
      cy.get("#computed-results #total-price-result").should(
        "contain.text",
        "$5000"
      )

      // Change width via slider
      cy.get("#rectangle-controls #width-slider")
        .invoke("val", 15)
        .trigger("input")
      cy.get("#rectangle-controls #width-display").should("contain.text", "15")

      // Check computed values update (15 * 5 = 75, perimeter = 40, price = 7500)
      cy.get("#computed-results #area-result").should(
        "contain.text",
        "75 sq units"
      )
      cy.get("#computed-results #perimeter-result").should(
        "contain.text",
        "40 units"
      )
      cy.get("#computed-results #total-price-result").should(
        "contain.text",
        "$7500"
      )
    })

    it("should update visual rectangle when dimensions change", () => {
      // Check initial visual size (10 * 10 = 100px width, 5 * 10 = 50px height)
      cy.get("#visual-rectangle #rectangle").should(
        "have.css",
        "width",
        "100px"
      )
      cy.get("#visual-rectangle #rectangle").should(
        "have.css",
        "height",
        "50px"
      )

      // Change width
      cy.get("#rectangle-controls #width-slider")
        .invoke("val", 8)
        .trigger("input")
      cy.get("#visual-rectangle #rectangle").should("have.css", "width", "80px")

      // Change height
      cy.get("#rectangle-controls #height-slider")
        .invoke("val", 7)
        .trigger("input")
      cy.get("#visual-rectangle #rectangle").should(
        "have.css",
        "height",
        "70px"
      )
    })

    it("should calculate total price correctly with different price per unit", () => {
      // Change price per unit
      cy.get("#rectangle-controls #price-input").clear().type("200")

      // Check total price calculation (10 * 5 * 200 = 10000)
      cy.get("#computed-results #total-price-result").should(
        "contain.text",
        "$10000"
      )
    })
  })

  describe("Watch Effects", () => {
    it("should validate username and log changes", () => {
      // Clear log first
      cy.get("#watch-log #clear-log").click()
      cy.get("#watch-log #log-output").should("contain.text", "No logs yet...")

      // Test invalid username
      cy.get("#watch-controls #username-input").type("ab")
      cy.get("#watch-controls #username-validation").should(
        "have.class",
        "invalid"
      )
      cy.get("#watch-controls #username-validation").should(
        "contain.text",
        "✗ Username too short"
      )

      // Check log entries
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        'Username changed to: "ab"'
      )
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        "Username validation: invalid"
      )

      // Test valid username
      cy.get("#watch-controls #username-input").clear().type("alice")
      cy.get("#watch-controls #username-validation").should(
        "have.class",
        "valid"
      )
      cy.get("#watch-controls #username-validation").should(
        "contain.text",
        "✓ Valid username"
      )

      // Check updated log
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        'Username changed to: "alice"'
      )
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        "Username validation: valid"
      )
    })

    it("should log theme changes", () => {
      cy.get("#watch-log #clear-log").click()

      // Change theme
      cy.get("#watch-controls #theme-select").select("light")

      // Check log
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        "Theme changed to: light"
      )

      // Change back
      cy.get("#watch-controls #theme-select").select("dark")
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        "Theme changed to: dark"
      )
    })

    it("should track click count", () => {
      cy.get("#watch-log #clear-log").click()

      // Click button multiple times
      cy.get("#watch-controls #click-counter").should(
        "contain.text",
        "Click me! (0)"
      )
      cy.get("#watch-controls #click-counter").click().click().click()
      cy.get("#watch-controls #click-counter").should(
        "contain.text",
        "Click me! (3)"
      )

      // Check log
      cy.get("#watch-log .log-entry").should(
        "contain.text",
        "Button clicked 3 times"
      )
    })
  })

  describe("Shopping Cart Integration", () => {
    it("should add items to cart and calculate totals", () => {
      // Initially cart should be empty
      cy.get("#cart-summary #empty-cart").should(
        "contain.text",
        "Your cart is empty"
      )

      // Add laptop to cart
      cy.get("#products #product-1 .add-item").click().click()
      cy.get("#products #product-1 .quantity").should("contain.text", "2")

      // Check cart updates
      cy.get("#cart-summary").should("contain.text", "Cart Summary (2 items)")
      cy.get("#cart-summary .cart-item").should(
        "contain.text",
        "Laptop x2 - $1998.00"
      )
      cy.get("#cart-summary #subtotal").should(
        "contain.text",
        "Subtotal: $1998.00"
      )
      cy.get("#cart-summary #total").should("contain.text", "Total: $1998.00")

      // Check notifications
      cy.get("#notifications-section .notification").should(
        "contain.text",
        "Cart updated: 2 items"
      )
    })

    it("should apply discount codes correctly", () => {
      // Add item first
      cy.get("#products #product-2 .add-item").click() // Mouse - $29

      // Apply 10% discount
      cy.get("#discount-section #discount-input").type("SAVE10")
      cy.get("#discount-section #discount-applied").should(
        "contain.text",
        "✓ 10% discount applied!"
      )

      // Check discount calculation
      cy.get("#cart-summary #discount-display").should(
        "contain.text",
        "Discount (10%): -$2.90"
      )
      cy.get("#cart-summary #total").should("contain.text", "Total: $26.10")

      // Check notification
      cy.get("#notifications-section .notification").should(
        "contain.text",
        "Discount applied: 10% off!"
      )
    })

    it("should handle multiple products and higher discount", () => {
      // Add multiple items
      cy.get("#products #product-1 .add-item").click() // Laptop - $999
      cy.get("#products #product-3 .add-item").click() // Keyboard - $89

      // Apply 20% discount
      cy.get("#discount-section #discount-input").type("SAVE20")
      cy.get("#discount-section #discount-applied").should(
        "contain.text",
        "✓ 20% discount applied!"
      )

      // Check calculations (999 + 89 = 1088, 20% discount = 217.60, total = 870.40)
      cy.get("#cart-summary #subtotal").should(
        "contain.text",
        "Subtotal: $1088.00"
      )
      cy.get("#cart-summary #discount-display").should(
        "contain.text",
        "Discount (20%): -$217.60"
      )
      cy.get("#cart-summary #total").should("contain.text", "Total: $870.40")
    })

    it("should remove items from cart", () => {
      // Add item first
      cy.get("#products #product-2 .add-item").click().click() // 2 mice
      cy.get("#products #product-2 .quantity").should("contain.text", "2")

      // Remove one item
      cy.get("#products #product-2 .remove-item").click()
      cy.get("#products #product-2 .quantity").should("contain.text", "1")

      // Check cart updates
      cy.get("#cart-summary").should("contain.text", "Cart Summary (1 items)")
      cy.get("#cart-summary #total").should("contain.text", "Total: $29.00")

      // Remove last item
      cy.get("#products #product-2 .remove-item").click()
      cy.get("#products #product-2 .quantity").should("contain.text", "0")
      cy.get("#cart-summary #empty-cart").should(
        "contain.text",
        "Your cart is empty"
      )
    })

    it("should disable remove button when quantity is zero", () => {
      // Initially all remove buttons should be disabled
      cy.get("#products .remove-item").should("be.disabled")

      // Add item and check remove button is enabled
      cy.get("#products #product-1 .add-item").click()
      cy.get("#products #product-1 .remove-item").should("not.be.disabled")

      // Remove item and check button is disabled again
      cy.get("#products #product-1 .remove-item").click()
      cy.get("#products #product-1 .remove-item").should("be.disabled")
    })
  })

  describe("Global Signals", () => {
    it("should maintain global counter state across interactions", () => {
      // Test global counter
      cy.get("#global-counter #global-count").should("contain.text", "0")
      cy.get("#global-counter #global-squared").should(
        "contain.text",
        "Squared: 0"
      )

      // Increment global counter
      cy.get("#global-counter #global-increment").click().click().click()
      cy.get("#global-counter #global-count").should("contain.text", "3")
      cy.get("#global-counter #global-squared").should(
        "contain.text",
        "Squared: 9"
      )

      // Check global overview reflects the same values
      cy.get("#global-overview #global-counter-value").should(
        "contain.text",
        "Counter: 3"
      )
      cy.get("#global-overview #global-counter-squared-value").should(
        "contain.text",
        "Counter²: 9"
      )
    })

    it("should update global message across widgets", () => {
      // Test global message
      cy.get("#global-message #global-message-input").should(
        "have.value",
        "Global state test"
      )
      cy.get("#global-message #global-message-display").should(
        "contain.text",
        '"Global state test"'
      )

      // Change global message
      cy.get("#global-message #global-message-input")
        .clear()
        .type("New global message")
      cy.get("#global-message #global-message-display").should(
        "contain.text",
        '"New global message"'
      )

      // Check global overview
      cy.get("#global-overview #global-message-length").should(
        "contain.text",
        "Message Length: 18 chars"
      )
    })

    it("should manage global user status", () => {
      // Check initial user states
      cy.get("#global-users #user-1 .user-status").should(
        "contain.text",
        "Alice (Online)"
      )
      cy.get("#global-users #user-2 .user-status").should(
        "contain.text",
        "Bob (Offline)"
      )
      cy.get("#global-users #users-stats").should(
        "contain.text",
        "Online Users: 1"
      )
      cy.get("#global-overview #global-online-count").should(
        "contain.text",
        "Online Users: 1"
      )

      // Toggle Alice offline
      cy.get("#global-users #user-1 .toggle-status").click()
      cy.get("#global-users #user-1 .user-status").should(
        "contain.text",
        "Alice (Offline)"
      )
      cy.get("#global-users #users-stats").should(
        "contain.text",
        "Online Users: 0"
      )
      cy.get("#global-overview #global-online-count").should(
        "contain.text",
        "Online Users: 0"
      )

      // Toggle Bob online
      cy.get("#global-users #user-2 .toggle-status").click()
      cy.get("#global-users #user-2 .user-status").should(
        "contain.text",
        "Bob (Online)"
      )
      cy.get("#global-users #users-stats").should(
        "contain.text",
        "Online Users: 1"
      )
      cy.get("#global-overview #global-online-count").should(
        "contain.text",
        "Online Users: 1"
      )
    })

    it("should log global activity", () => {
      // Clear global log
      cy.get("#global-log #clear-global-log").click()
      cy.get("#global-log #global-log-output").should(
        "contain.text",
        "No global activity yet..."
      )

      // Trigger global state change
      cy.get("#global-counter #global-increment").click()

      // Check global log
      cy.get("#global-log .global-log-entry").should(
        "contain.text",
        "Global counter: 1"
      )

      // Multiple changes
      cy.get("#global-counter #global-increment").click().click()
      cy.get("#global-log .global-log-entry").should(
        "contain.text",
        "Global counter: 3"
      )
    })

    it("should persist global state during page interactions", () => {
      // Set global counter
      cy.get("#global-counter #global-increment").click().click()
      cy.get("#global-counter #global-count").should("contain.text", "2")

      // Interact with other components
      cy.get("#counter-signal #increment").click()
      cy.get("#string-signal #name-input").clear().type("test")

      // Global counter should still be the same
      cy.get("#global-counter #global-count").should("contain.text", "2")
      cy.get("#global-overview #global-counter-value").should(
        "contain.text",
        "Counter: 2"
      )
    })
  })

  describe("Component Layout and Structure", () => {
    it("should have all required sections", () => {
      cy.get("#signals h1").should("contain.text", "Signals Test")
      cy.get("#signal-demo h2").should("contain.text", "Signal Demo")
      cy.get("#computed-demo h2").should("contain.text", "Computed Demo")
      cy.get("#watch-demo h2").should("contain.text", "Watch Demo")
      cy.get("#shopping-cart h2").should(
        "contain.text",
        "Shopping Cart (Integrated Demo)"
      )
      cy.get("#global-demo h2").should("contain.text", "Global Signals Demo")
    })

    it("should have proper form controls", () => {
      // Check all inputs exist
      cy.get("#name-input").should("exist")
      cy.get("#width-slider").should("exist")
      cy.get("#height-slider").should("exist")
      cy.get("#price-input").should("exist")
      cy.get("#username-input").should("exist")
      cy.get("#theme-select").should("exist")
      cy.get("#discount-input").should("exist")
      cy.get("#global-message-input").should("exist")

      // Check all buttons exist
      cy.get("#increment").should("exist")
      cy.get("#decrement").should("exist")
      cy.get("#click-counter").should("exist")
      cy.get("#clear-log").should("exist")
      cy.get(".add-item").should("exist")
      cy.get(".remove-item").should("exist")
      cy.get(".toggle-status").should("exist")
    })

    it("should have proper accessibility attributes", () => {
      // Check labels exist
      cy.get("label").should("exist")

      // Check buttons have text
      cy.get("button").each(($btn) => {
        cy.wrap($btn).should("not.be.empty")
      })

      // Check inputs have placeholders or labels
      cy.get("input[type='text']").each(($input) => {
        cy.wrap($input).should("satisfy", ($el) => {
          return $el.attr("placeholder") || $el.prev("label").length > 0
        })
      })
    })
  })

  describe("Error Handling and Edge Cases", () => {
    it("should handle empty input gracefully", () => {
      // Clear price input
      cy.get("#price-input").clear()
      cy.get("#total-price-result").should("contain.text", "$0")

      // Clear global message
      cy.get("#global-message-input").clear()
      cy.get("#global-message-display").should("contain.text", '""')
      cy.get("#global-overview #global-message-length").should(
        "contain.text",
        "Message Length: 0 chars"
      )
    })

    it("should handle rapid clicking", () => {
      // Rapidly click increment button
      for (let i = 0; i < 10; i++) {
        cy.get("#increment").click()
      }
      cy.get("#count-display").should("contain.text", "10")

      // Rapidly add items to cart
      for (let i = 0; i < 5; i++) {
        cy.get("#products #product-1 .add-item").click()
      }
      cy.get("#products #product-1 .quantity").should("contain.text", "5")
      cy.get("#cart-summary").should("contain.text", "Cart Summary (5 items)")
    })

    it("should handle invalid discount codes", () => {
      // Add item to cart
      cy.get("#products #product-1 .add-item").click()

      // Try invalid discount code
      cy.get("#discount-input").type("INVALID")
      cy.get("#discount-applied").should("not.exist")
      cy.get("#total").should("contain.text", "Total: $999.00") // No discount applied
    })
  })
})
