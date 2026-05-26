import { ref, signal, computed, effect, For } from "kiru"

// Global signals for testing global state
const globalCounter = signal(0)
const globalMessage = signal("Global state test")
const globalUsers = signal([
  { id: 1, name: "Alice", online: true },
  { id: 2, name: "Bob", online: false },
])

// Global computed
const globalCounterSquared = computed(() => globalCounter() ** 2)
const onlineUsersCount = computed(
  () => globalUsers().filter((u) => u.online).length
)

// Global watch for testing
const globalLogs = signal<string[]>([])
effect([globalCounter], (counter) => {
  const timestamp = new Date().toLocaleTimeString()
  globalLogs.set((prev) =>
    [...prev, `[${timestamp}] Global counter: ${counter}`].slice(-5)
  )
})

export default function SignalsTest() {
  // Component-scoped signals
  const count = signal(0)
  const name = signal("World")
  const width = signal(10)
  const height = signal(5)
  const price = signal(100)
  const username = signal("")
  const theme = signal<"light" | "dark">("dark")
  const clickCount = signal(0)
  const logs = signal<string[]>([])

  // Computed signals
  const area = computed(() => width() * height())
  const perimeter = computed(() => 2 * (width() + height()))
  const totalPrice = computed(() => area() * price())
  const isValidUsername = computed(() => username().length >= 3)

  // Shopping cart state
  const products = signal([
    { id: 1, name: "Laptop", price: 999, quantity: 0 },
    { id: 2, name: "Mouse", price: 29, quantity: 0 },
    { id: 3, name: "Keyboard", price: 89, quantity: 0 },
  ])
  const discountCode = signal("")
  const notifications = signal<string[]>([])

  // Shopping cart computed
  const cartItems = computed(() => products().filter((p) => p.quantity > 0))
  const itemCount = computed(() =>
    cartItems().reduce((sum, item) => sum + item.quantity, 0)
  )
  const subtotal = computed(() =>
    cartItems().reduce((sum, item) => sum + item.price * item.quantity, 0)
  )
  const discount = computed(() => {
    const code = discountCode().toUpperCase()
    if (code === "SAVE10") return 0.1
    if (code === "SAVE20") return 0.2
    return 0
  })
  const discountAmount = computed(() => subtotal() * discount())
  const total = computed(() => subtotal() - discountAmount())

  // Refs for testing DOM interactions
  const logRef = ref<HTMLDivElement>(null)

  // Helper functions
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    logs.set((prev) => [...prev, `[${timestamp}] ${message}`].slice(-10))
  }

  const addNotification = (message: string) => {
    notifications.set((prev) => [...prev, message].slice(-5))
  }

  const updateQuantity = (productId: number, delta: number) => {
    products.set((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, quantity: Math.max(0, p.quantity + delta) }
          : p
      )
    )
  }

  const toggleUserStatus = (userId: number) => {
    globalUsers.set((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, online: !user.online } : user
      )
    )
  }

  // Watch effects
  effect([username, isValidUsername], (username, isValid) => {
    addLog(`Username changed to: "${username}"`)
    addLog(`Username validation: ${isValid ? "valid" : "invalid"}`)
  })

  effect(() => {
    addLog(`Theme changed to: ${theme()}`)
  })

  effect([clickCount], (clickCount) => {
    if (clickCount > 0) {
      addLog(`Button clicked ${clickCount} times`)
    }
  })

  effect([itemCount], (itemCount) => {
    if (itemCount > 0) {
      addNotification(`Cart updated: ${itemCount} items`)
    }
  })

  effect([discount], (discount) => {
    if (discount > 0) {
      addNotification(`Discount applied: ${Math.round(discount * 100)}% off!`)
    }
  })

  const nullableStringSignal = signal<string | null>(null)

  return () => (
    <div id="signals">
      <h1>Signals Test</h1>
      <span id="nullable-string">{nullableStringSignal}</span>
      {/* Basic Signal Tests */}
      <section id="signal-demo">
        <h2>Signal Demo</h2>

        <div id="counter-signal">
          <h3>Counter Signal</h3>
          <button id="decrement" onclick={() => count.set((c) => c - 1)}>
            -
          </button>
          <span id="count-display">{count()}</span>
          <button id="increment" onclick={() => count.set((c) => c + 1)}>
            +
          </button>
        </div>

        <div id="string-signal">
          <h3>String Signal</h3>
          <input
            id="name-input"
            type="text"
            bind:value={name}
            placeholder="Enter your name"
          />
          <p id="greeting">Hello, {name}!</p>
        </div>
      </section>

      {/* Computed Tests */}
      <section id="computed-demo">
        <h2>Computed Demo</h2>

        <div id="rectangle-controls">
          <h3>Rectangle Dimensions</h3>
          <div>
            <label>Width: </label>
            <input
              id="width-slider"
              type="range"
              min="1"
              max="20"
              bind:value={width}
            />
            <span id="width-display">{width}</span>
          </div>
          <div>
            <label>Height: </label>
            <input
              id="height-slider"
              type="range"
              min="1"
              max="20"
              bind:value={height}
            />
            <span id="height-display">{height}</span>
          </div>
          <div>
            <label>Price per sq unit: </label>
            <input id="price-input" type="number" bind:value={price} />
          </div>
        </div>

        <div id="computed-results">
          <h3>Computed Results</h3>
          <div id="area-result">Area: {area} sq units</div>
          <div id="perimeter-result">Perimeter: {perimeter} units</div>
          <div id="total-price-result">Total Price: ${totalPrice}</div>
        </div>

        <div id="visual-rectangle">
          <h3>Visual</h3>
          {() => (
            <div
              id="rectangle"
              style={{
                width: `${width() * 10}px`,
                height: `${height() * 10}px`,
                backgroundColor: "blue",
                border: "2px solid darkblue",
              }}
            />
          )}
        </div>
      </section>

      {/* Watch Tests */}
      <section id="watch-demo">
        <h2>Watch Demo</h2>

        <div id="watch-controls">
          <h3>Interactive Controls</h3>
          <div>
            <label>Username: </label>
            <input
              id="username-input"
              type="text"
              bind:value={username}
              placeholder="Enter username (3+ chars)"
            />
            {() => {
              if (!username()) return null
              const isValid = isValidUsername()
              return (
                <span
                  id="username-validation"
                  className={isValid ? "valid" : "invalid"}
                >
                  {isValid ? "✓ Valid username" : "✗ Username too short"}
                </span>
              )
            }}
          </div>

          <div>
            <label>Theme: </label>
            <select id="theme-select" bind:value={theme}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <button
            id="click-counter"
            onclick={() => clickCount.set((c) => c + 1)}
          >
            Click me! ({clickCount})
          </button>
        </div>

        <div id="watch-log">
          <h3>Watch Effect Log</h3>
          <div ref={logRef} id="log-output">
            <For each={logs} fallback={<div>No logs yet...</div>}>
              {(log) => <div className="log-entry">{log}</div>}
            </For>
          </div>
          <button id="clear-log" onclick={() => logs.set([])}>
            Clear Log
          </button>
        </div>
      </section>

      {/* Shopping Cart Integration Test */}
      <section id="shopping-cart">
        <h2>Shopping Cart (Integrated Demo)</h2>

        <div id="products">
          <h3>Products</h3>
          <For each={products}>
            {(product) => (
              <div key={product.id} id={`product-${product.id}`}>
                <span>
                  {product.name} - ${product.price}
                </span>
                <button
                  className="remove-item"
                  onclick={() => updateQuantity(product.id, -1)}
                  disabled={product.quantity === 0}
                >
                  -
                </button>
                <span className="quantity">{product.quantity}</span>
                <button
                  className="add-item"
                  onclick={() => updateQuantity(product.id, 1)}
                >
                  +
                </button>
              </div>
            )}
          </For>
        </div>

        <div id="cart-summary">
          <h3>Cart Summary ({itemCount} items)</h3>
          {() => {
            const items = cartItems()
            const _discount = discount()
            const placeholders = {
              subtotal: subtotal().toFixed(2),
              discountAmount: discountAmount().toFixed(2),
              total: total().toFixed(2),
            }
            if (items.length === 0)
              return <div id="empty-cart">Your cart is empty</div>

            return (
              <div>
                {items.map((item) => (
                  <div key={item.id} className="cart-item">
                    {item.name} x{item.quantity} - $
                    {(item.price * item.quantity).toFixed(2)}
                  </div>
                ))}
                <div id="subtotal">Subtotal: ${placeholders.subtotal}</div>
                {_discount > 0 && (
                  <div id="discount-display">
                    Discount ({Math.round(_discount * 100)}%): -$
                    {placeholders.discountAmount}
                  </div>
                )}
                <div id="total">Total: ${placeholders.total}</div>
              </div>
            )
          }}

          {/* {cartItems().length === 0 ? (
            <div id="empty-cart">Your cart is empty</div>
          ) : (
            <div>
              {cartItems().map((item) => (
                <div key={item.id} className="cart-item">
                  {item.name} x{item.quantity} - $
                  {(item.price * item.quantity).toFixed(2)}
                </div>
              ))}
              <div id="subtotal">Subtotal: ${subtotal().toFixed(2)}</div>
              {discount() > 0 && (
                <div id="discount-display">
                  Discount ({Math.round(discount() * 100)}%): -$
                  {discountAmount().toFixed(2)}
                </div>
              )}
              <div id="total">Total: ${total().toFixed(2)}</div>
            </div>
          )} */}
        </div>

        <div id="discount-section">
          <h3>Discount Code</h3>
          <input
            id="discount-input"
            type="text"
            bind:value={discountCode}
            placeholder="Try: SAVE10, SAVE20"
          />
          {() =>
            discount() > 0 && (
              <div id="discount-applied">
                ✓ {Math.round(discount() * 100)}% discount applied!
              </div>
            )
          }
        </div>

        <div id="notifications-section">
          <h3>Notifications</h3>
          <div id="notifications-list">
            <For each={notifications} fallback={<div>No notifications</div>}>
              {(notification) => (
                <div className="notification">{notification}</div>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* Global Signals Tests */}
      <section id="global-demo">
        <h2>Global Signals Demo</h2>

        <div id="global-counter">
          <h3>Global Counter Widget</h3>
          <button
            id="global-decrement"
            onclick={() => globalCounter.set((c) => c - 1)}
          >
            -
          </button>
          <span id="global-count">{globalCounter}</span>
          <button
            id="global-increment"
            onclick={() => globalCounter.set((c) => c + 1)}
          >
            +
          </button>
          <div id="global-squared">Squared: {globalCounterSquared}</div>
        </div>

        <div id="global-message">
          <h3>Global Message Widget</h3>
          <input
            id="global-message-input"
            type="text"
            bind:value={globalMessage}
            placeholder="Global message"
          />
          <div id="global-message-display">"{globalMessage}"</div>
        </div>

        <div id="global-users">
          <h3>Global Users Widget</h3>
          <For each={globalUsers}>
            {(user) => (
              <div key={user.id} id={`user-${user.id}`}>
                <span
                  className={`user-status ${
                    user.online ? "online" : "offline"
                  }`}
                >
                  {user.name} ({user.online ? "Online" : "Offline"})
                </span>
                <button
                  className="toggle-status"
                  onclick={() => toggleUserStatus(user.id)}
                >
                  Toggle Status
                </button>
              </div>
            )}
          </For>
          <div id="users-stats">Online Users: {onlineUsersCount}</div>
        </div>

        <div id="global-log">
          <h3>Global Activity Log</h3>
          <div id="global-log-output">
            <For
              each={globalLogs}
              fallback={<div>No global activity yet...</div>}
            >
              {(log) => <div className="global-log-entry">{log}</div>}
            </For>
          </div>
          <button id="clear-global-log" onclick={() => globalLogs.set([])}>
            Clear Global Log
          </button>
        </div>

        <div id="global-overview">
          <h3>Global State Overview</h3>
          <div id="global-counter-value">Counter: {globalCounter}</div>
          <div id="global-counter-squared-value">
            Counter²: {globalCounterSquared}
          </div>
          <div id="global-message-length">
            Message Length: {() => globalMessage().length} chars
          </div>
          <div id="global-online-count">Online Users: {onlineUsersCount}</div>
        </div>
      </section>
    </div>
  )
}
