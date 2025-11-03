import {
  useSignal,
  useComputed,
  useWatch,
  useRef,
  signal,
  computed,
  watch,
} from "kiru"

// Global signals for testing global state
const globalCounter = signal(0)
const globalMessage = signal("Global state test")
const globalUsers = signal([
  { id: 1, name: "Alice", online: true },
  { id: 2, name: "Bob", online: false },
])

// Global computed
const globalCounterSquared = computed(() => globalCounter.value ** 2)
const onlineUsersCount = computed(
  () => globalUsers.value.filter((u) => u.online).length
)

// Global watch for testing
const globalLogs = signal<string[]>([])
watch([globalCounter], (counter) => {
  const timestamp = new Date().toLocaleTimeString()
  globalLogs.value = [
    ...globalLogs.peek(),
    `[${timestamp}] Global counter: ${counter}`,
  ].slice(-5)
})

export default function SignalsTest() {
  // Component-scoped signals
  const count = useSignal(0)
  const name = useSignal("World")
  const width = useSignal(10)
  const height = useSignal(5)
  const price = useSignal(100)
  const username = useSignal("")
  const theme = useSignal<"light" | "dark">("dark")
  const clickCount = useSignal(0)
  const logs = useSignal<string[]>([])

  // Computed signals
  const area = useComputed(() => width.value * height.value)
  const perimeter = useComputed(() => 2 * (width.value + height.value))
  const totalPrice = useComputed(() => area.value * price.value)
  const isValidUsername = useComputed(() => username.value.length >= 3)

  // Shopping cart state
  const products = useSignal([
    { id: 1, name: "Laptop", price: 999, quantity: 0 },
    { id: 2, name: "Mouse", price: 29, quantity: 0 },
    { id: 3, name: "Keyboard", price: 89, quantity: 0 },
  ])
  const discountCode = useSignal("")
  const notifications = useSignal<string[]>([])

  // Shopping cart computed
  const cartItems = useComputed(() =>
    products.value.filter((p) => p.quantity > 0)
  )
  const itemCount = useComputed(() =>
    cartItems.value.reduce((sum, item) => sum + item.quantity, 0)
  )
  const subtotal = useComputed(() =>
    cartItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )
  const discount = useComputed(() => {
    const code = discountCode.value.toUpperCase()
    if (code === "SAVE10") return 0.1
    if (code === "SAVE20") return 0.2
    return 0
  })
  const discountAmount = useComputed(() => subtotal.value * discount.value)
  const total = useComputed(() => subtotal.value - discountAmount.value)

  // Refs for testing DOM interactions
  const logRef = useRef<HTMLDivElement>(null)

  // Helper functions
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    logs.value = [...logs.peek(), `[${timestamp}] ${message}`].slice(-10)
  }

  const addNotification = (message: string) => {
    notifications.value = [...notifications.peek(), message].slice(-5)
  }

  const updateQuantity = (productId: number, delta: number) => {
    products.value = products.value.map((p) =>
      p.id === productId
        ? { ...p, quantity: Math.max(0, p.quantity + delta) }
        : p
    )
  }

  const toggleUserStatus = (userId: number) => {
    globalUsers.value = globalUsers.value.map((user) =>
      user.id === userId ? { ...user, online: !user.online } : user
    )
  }

  // Watch effects
  useWatch([username, isValidUsername], (username, isValid) => {
    addLog(`Username changed to: "${username}"`)
    addLog(`Username validation: ${isValid ? "valid" : "invalid"}`)
  })

  useWatch(() => {
    addLog(`Theme changed to: ${theme}`)
  })

  useWatch([clickCount], (clickCount) => {
    if (clickCount > 0) {
      addLog(`Button clicked ${clickCount} times`)
    }
  })

  useWatch([itemCount], (itemCount) => {
    if (itemCount > 0) {
      addNotification(`Cart updated: ${itemCount} items`)
    }
  })

  useWatch([discount], (discount) => {
    if (discount > 0) {
      addNotification(`Discount applied: ${Math.round(discount * 100)}% off!`)
    }
  })

  const nullableStringSignal = useSignal<string | null>(null)

  return (
    <div id="signals">
      <h1>Signals Test</h1>
      <span id="nullable-string">{nullableStringSignal}</span>
      {/* Basic Signal Tests */}
      <section id="signal-demo">
        <h2>Signal Demo</h2>

        <div id="counter-signal">
          <h3>Counter Signal</h3>
          <button id="decrement" onclick={() => count.value--}>
            -
          </button>
          <span id="count-display">{count.value}</span>
          <button id="increment" onclick={() => count.value++}>
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
          <p id="greeting">Hello, {name.value}!</p>
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
            <span id="width-display">{width.value}</span>
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
            <span id="height-display">{height.value}</span>
          </div>
          <div>
            <label>Price per sq unit: </label>
            <input
              id="price-input"
              type="number"
              value={price}
              oninput={(e) => (price.value = Number(e.target.value))}
            />
          </div>
        </div>

        <div id="computed-results">
          <h3>Computed Results</h3>
          <div id="area-result">Area: {area.value} sq units</div>
          <div id="perimeter-result">Perimeter: {perimeter.value} units</div>
          <div id="total-price-result">Total Price: ${totalPrice.value}</div>
        </div>

        <div id="visual-rectangle">
          <h3>Visual</h3>
          <div
            id="rectangle"
            style={{
              width: `${width.value * 10}px`,
              height: `${height.value * 10}px`,
              backgroundColor: "blue",
              border: "2px solid darkblue",
            }}
          />
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
            {username.value && (
              <span
                id="username-validation"
                className={isValidUsername.value ? "valid" : "invalid"}
              >
                {isValidUsername.value
                  ? "✓ Valid username"
                  : "✗ Username too short"}
              </span>
            )}
          </div>

          <div>
            <label>Theme: </label>
            <select id="theme-select" bind:value={theme}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <button id="click-counter" onclick={() => clickCount.value++}>
            Click me! ({clickCount.value})
          </button>
        </div>

        <div id="watch-log">
          <h3>Watch Effect Log</h3>
          <div ref={logRef} id="log-output">
            {logs.value.length === 0 ? (
              <div>No logs yet...</div>
            ) : (
              logs.value.map((log, index) => (
                <div key={index} className="log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
          <button id="clear-log" onclick={() => (logs.value = [])}>
            Clear Log
          </button>
        </div>
      </section>

      {/* Shopping Cart Integration Test */}
      <section id="shopping-cart">
        <h2>Shopping Cart (Integrated Demo)</h2>

        <div id="products">
          <h3>Products</h3>
          {products.value.map((product) => (
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
          ))}
        </div>

        <div id="cart-summary">
          <h3>Cart Summary ({itemCount.value} items)</h3>
          {cartItems.value.length === 0 ? (
            <div id="empty-cart">Your cart is empty</div>
          ) : (
            <div>
              {cartItems.value.map((item) => (
                <div key={item.id} className="cart-item">
                  {item.name} x{item.quantity} - $
                  {(item.price * item.quantity).toFixed(2)}
                </div>
              ))}
              <div id="subtotal">Subtotal: ${subtotal.value.toFixed(2)}</div>
              {discount.value > 0 && (
                <div id="discount-display">
                  Discount ({Math.round(discount.value * 100)}%): -$
                  {discountAmount.value.toFixed(2)}
                </div>
              )}
              <div id="total">Total: ${total.value.toFixed(2)}</div>
            </div>
          )}
        </div>

        <div id="discount-section">
          <h3>Discount Code</h3>
          <input
            id="discount-input"
            type="text"
            bind:value={discountCode}
            placeholder="Try: SAVE10, SAVE20"
          />
          {discount.value > 0 && (
            <div id="discount-applied">
              ✓ {Math.round(discount.value * 100)}% discount applied!
            </div>
          )}
        </div>

        <div id="notifications-section">
          <h3>Notifications</h3>
          <div id="notifications-list">
            {notifications.value.length === 0 ? (
              <div>No notifications</div>
            ) : (
              notifications.value.map((notification, index) => (
                <div key={index} className="notification">
                  {notification}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Global Signals Tests */}
      <section id="global-demo">
        <h2>Global Signals Demo</h2>

        <div id="global-counter">
          <h3>Global Counter Widget</h3>
          <button id="global-decrement" onclick={() => globalCounter.value--}>
            -
          </button>
          <span id="global-count">{globalCounter.value}</span>
          <button id="global-increment" onclick={() => globalCounter.value++}>
            +
          </button>
          <div id="global-squared">Squared: {globalCounterSquared.value}</div>
        </div>

        <div id="global-message">
          <h3>Global Message Widget</h3>
          <input
            id="global-message-input"
            type="text"
            bind:value={globalMessage}
            placeholder="Global message"
          />
          <div id="global-message-display">"{globalMessage.value}"</div>
        </div>

        <div id="global-users">
          <h3>Global Users Widget</h3>
          {globalUsers.value.map((user) => (
            <div key={user.id} id={`user-${user.id}`}>
              <span
                className={`user-status ${user.online ? "online" : "offline"}`}
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
          ))}
          <div id="users-stats">Online Users: {onlineUsersCount.value}</div>
        </div>

        <div id="global-log">
          <h3>Global Activity Log</h3>
          <div id="global-log-output">
            {globalLogs.value.length === 0 ? (
              <div>No global activity yet...</div>
            ) : (
              globalLogs.value.map((log, index) => (
                <div key={index} className="global-log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
          <button id="clear-global-log" onclick={() => (globalLogs.value = [])}>
            Clear Global Log
          </button>
        </div>

        <div id="global-overview">
          <h3>Global State Overview</h3>
          <div id="global-counter-value">Counter: {globalCounter.value}</div>
          <div id="global-counter-squared-value">
            Counter²: {globalCounterSquared.value}
          </div>
          <div id="global-message-length">
            Message Length: {globalMessage.value.length} chars
          </div>
          <div id="global-online-count">
            Online Users: {onlineUsersCount.value}
          </div>
        </div>
      </section>
    </div>
  )
}
