import { ref, signal, computed, effect } from "kiru";
// Global signals for testing global state
const globalCounter = signal(0);
const globalMessage = signal("Global state test");
const globalUsers = signal([
    { id: 1, name: "Alice", online: true },
    { id: 2, name: "Bob", online: false },
]);
// Global computed
const globalCounterSquared = computed(() => globalCounter.value ** 2);
const onlineUsersCount = computed(() => globalUsers.value.filter((u) => u.online).length);
// Global watch for testing
const globalLogs = signal([]);
effect([globalCounter], (counter) => {
    const timestamp = new Date().toLocaleTimeString();
    globalLogs.value = [
        ...globalLogs.peek(),
        `[${timestamp}] Global counter: ${counter}`,
    ].slice(-5);
});
export default function SignalsTest() {
    // Component-scoped signals
    const count = signal(0);
    const name = signal("World");
    const width = signal(10);
    const height = signal(5);
    const price = signal(100);
    const username = signal("");
    const theme = signal("dark");
    const clickCount = signal(0);
    const logs = signal([]);
    // Computed signals
    const area = computed(() => width.value * height.value);
    const perimeter = computed(() => 2 * (width.value + height.value));
    const totalPrice = computed(() => area.value * price.value);
    const isValidUsername = computed(() => username.value.length >= 3);
    // Shopping cart state
    const products = signal([
        { id: 1, name: "Laptop", price: 999, quantity: 0 },
        { id: 2, name: "Mouse", price: 29, quantity: 0 },
        { id: 3, name: "Keyboard", price: 89, quantity: 0 },
    ]);
    const discountCode = signal("");
    const notifications = signal([]);
    // Shopping cart computed
    const cartItems = computed(() => products.value.filter((p) => p.quantity > 0));
    const itemCount = computed(() => cartItems.value.reduce((sum, item) => sum + item.quantity, 0));
    const subtotal = computed(() => cartItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const discount = computed(() => {
        const code = discountCode.value.toUpperCase();
        if (code === "SAVE10")
            return 0.1;
        if (code === "SAVE20")
            return 0.2;
        return 0;
    });
    const discountAmount = computed(() => subtotal.value * discount.value);
    const total = computed(() => subtotal.value - discountAmount.value);
    // Refs for testing DOM interactions
    const logRef = ref(null);
    // Helper functions
    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        logs.value = [...logs.peek(), `[${timestamp}] ${message}`].slice(-10);
    };
    const addNotification = (message) => {
        notifications.value = [...notifications.peek(), message].slice(-5);
    };
    const updateQuantity = (productId, delta) => {
        products.value = products.value.map((p) => p.id === productId
            ? { ...p, quantity: Math.max(0, p.quantity + delta) }
            : p);
    };
    const toggleUserStatus = (userId) => {
        globalUsers.value = globalUsers.value.map((user) => user.id === userId ? { ...user, online: !user.online } : user);
    };
    // Watch effects
    effect([username, isValidUsername], (username, isValid) => {
        addLog(`Username changed to: "${username}"`);
        addLog(`Username validation: ${isValid ? "valid" : "invalid"}`);
    });
    effect(() => {
        addLog(`Theme changed to: ${theme}`);
    });
    effect([clickCount], (clickCount) => {
        if (clickCount > 0) {
            addLog(`Button clicked ${clickCount} times`);
        }
    });
    effect([itemCount], (itemCount) => {
        if (itemCount > 0) {
            addNotification(`Cart updated: ${itemCount} items`);
        }
    });
    effect([discount], (discount) => {
        if (discount > 0) {
            addNotification(`Discount applied: ${Math.round(discount * 100)}% off!`);
        }
    });
    const nullableStringSignal = signal(null);
    return () => (kiru.createElement("div", { id: "signals" },
        kiru.createElement("h1", null, "Signals Test"),
        kiru.createElement("span", { id: "nullable-string" }, nullableStringSignal),
        kiru.createElement("section", { id: "signal-demo" },
            kiru.createElement("h2", null, "Signal Demo"),
            kiru.createElement("div", { id: "counter-signal" },
                kiru.createElement("h3", null, "Counter Signal"),
                kiru.createElement("button", { id: "decrement", onclick: () => count.value-- }, "-"),
                kiru.createElement("span", { id: "count-display" }, count.value),
                kiru.createElement("button", { id: "increment", onclick: () => count.value++ }, "+")),
            kiru.createElement("div", { id: "string-signal" },
                kiru.createElement("h3", null, "String Signal"),
                kiru.createElement("input", { id: "name-input", type: "text", "bind:value": name, placeholder: "Enter your name" }),
                kiru.createElement("p", { id: "greeting" },
                    "Hello, ",
                    name.value,
                    "!"))),
        kiru.createElement("section", { id: "computed-demo" },
            kiru.createElement("h2", null, "Computed Demo"),
            kiru.createElement("div", { id: "rectangle-controls" },
                kiru.createElement("h3", null, "Rectangle Dimensions"),
                kiru.createElement("div", null,
                    kiru.createElement("label", null, "Width: "),
                    kiru.createElement("input", { id: "width-slider", type: "range", min: "1", max: "20", "bind:value": width }),
                    kiru.createElement("span", { id: "width-display" }, width.value)),
                kiru.createElement("div", null,
                    kiru.createElement("label", null, "Height: "),
                    kiru.createElement("input", { id: "height-slider", type: "range", min: "1", max: "20", "bind:value": height }),
                    kiru.createElement("span", { id: "height-display" }, height.value)),
                kiru.createElement("div", null,
                    kiru.createElement("label", null, "Price per sq unit: "),
                    kiru.createElement("input", { id: "price-input", type: "number", value: price, oninput: (e) => (price.value = Number(e.target.value)) }))),
            kiru.createElement("div", { id: "computed-results" },
                kiru.createElement("h3", null, "Computed Results"),
                kiru.createElement("div", { id: "area-result" },
                    "Area: ",
                    area.value,
                    " sq units"),
                kiru.createElement("div", { id: "perimeter-result" },
                    "Perimeter: ",
                    perimeter.value,
                    " units"),
                kiru.createElement("div", { id: "total-price-result" },
                    "Total Price: $",
                    totalPrice.value)),
            kiru.createElement("div", { id: "visual-rectangle" },
                kiru.createElement("h3", null, "Visual"),
                kiru.createElement("div", { id: "rectangle", style: {
                        width: `${width.value * 10}px`,
                        height: `${height.value * 10}px`,
                        backgroundColor: "blue",
                        border: "2px solid darkblue",
                    } }))),
        kiru.createElement("section", { id: "watch-demo" },
            kiru.createElement("h2", null, "Watch Demo"),
            kiru.createElement("div", { id: "watch-controls" },
                kiru.createElement("h3", null, "Interactive Controls"),
                kiru.createElement("div", null,
                    kiru.createElement("label", null, "Username: "),
                    kiru.createElement("input", { id: "username-input", type: "text", "bind:value": username, placeholder: "Enter username (3+ chars)" }),
                    username.value && (kiru.createElement("span", { id: "username-validation", className: isValidUsername.value ? "valid" : "invalid" }, isValidUsername.value
                        ? "✓ Valid username"
                        : "✗ Username too short"))),
                kiru.createElement("div", null,
                    kiru.createElement("label", null, "Theme: "),
                    kiru.createElement("select", { id: "theme-select", "bind:value": theme },
                        kiru.createElement("option", { value: "dark" }, "Dark"),
                        kiru.createElement("option", { value: "light" }, "Light"))),
                kiru.createElement("button", { id: "click-counter", onclick: () => clickCount.value++ },
                    "Click me! (",
                    clickCount.value,
                    ")")),
            kiru.createElement("div", { id: "watch-log" },
                kiru.createElement("h3", null, "Watch Effect Log"),
                kiru.createElement("div", { ref: logRef, id: "log-output" }, logs.value.length === 0 ? (kiru.createElement("div", null, "No logs yet...")) : (logs.value.map((log, index) => (kiru.createElement("div", { key: index, className: "log-entry" }, log))))),
                kiru.createElement("button", { id: "clear-log", onclick: () => (logs.value = []) }, "Clear Log"))),
        kiru.createElement("section", { id: "shopping-cart" },
            kiru.createElement("h2", null, "Shopping Cart (Integrated Demo)"),
            kiru.createElement("div", { id: "products" },
                kiru.createElement("h3", null, "Products"),
                products.value.map((product) => (kiru.createElement("div", { key: product.id, id: `product-${product.id}` },
                    kiru.createElement("span", null,
                        product.name,
                        " - $",
                        product.price),
                    kiru.createElement("button", { className: "remove-item", onclick: () => updateQuantity(product.id, -1), disabled: product.quantity === 0 }, "-"),
                    kiru.createElement("span", { className: "quantity" }, product.quantity),
                    kiru.createElement("button", { className: "add-item", onclick: () => updateQuantity(product.id, 1) }, "+"))))),
            kiru.createElement("div", { id: "cart-summary" },
                kiru.createElement("h3", null,
                    "Cart Summary (",
                    itemCount.value,
                    " items)"),
                cartItems.value.length === 0 ? (kiru.createElement("div", { id: "empty-cart" }, "Your cart is empty")) : (kiru.createElement("div", null,
                    cartItems.value.map((item) => (kiru.createElement("div", { key: item.id, className: "cart-item" },
                        item.name,
                        " x",
                        item.quantity,
                        " - $",
                        (item.price * item.quantity).toFixed(2)))),
                    kiru.createElement("div", { id: "subtotal" },
                        "Subtotal: $",
                        subtotal.value.toFixed(2)),
                    discount.value > 0 && (kiru.createElement("div", { id: "discount-display" },
                        "Discount (",
                        Math.round(discount.value * 100),
                        "%): -$",
                        discountAmount.value.toFixed(2))),
                    kiru.createElement("div", { id: "total" },
                        "Total: $",
                        total.value.toFixed(2))))),
            kiru.createElement("div", { id: "discount-section" },
                kiru.createElement("h3", null, "Discount Code"),
                kiru.createElement("input", { id: "discount-input", type: "text", "bind:value": discountCode, placeholder: "Try: SAVE10, SAVE20" }),
                discount.value > 0 && (kiru.createElement("div", { id: "discount-applied" },
                    "\u2713 ",
                    Math.round(discount.value * 100),
                    "% discount applied!"))),
            kiru.createElement("div", { id: "notifications-section" },
                kiru.createElement("h3", null, "Notifications"),
                kiru.createElement("div", { id: "notifications-list" }, notifications.value.length === 0 ? (kiru.createElement("div", null, "No notifications")) : (notifications.value.map((notification, index) => (kiru.createElement("div", { key: index, className: "notification" }, notification))))))),
        kiru.createElement("section", { id: "global-demo" },
            kiru.createElement("h2", null, "Global Signals Demo"),
            kiru.createElement("div", { id: "global-counter" },
                kiru.createElement("h3", null, "Global Counter Widget"),
                kiru.createElement("button", { id: "global-decrement", onclick: () => globalCounter.value-- }, "-"),
                kiru.createElement("span", { id: "global-count" }, globalCounter.value),
                kiru.createElement("button", { id: "global-increment", onclick: () => globalCounter.value++ }, "+"),
                kiru.createElement("div", { id: "global-squared" },
                    "Squared: ",
                    globalCounterSquared.value)),
            kiru.createElement("div", { id: "global-message" },
                kiru.createElement("h3", null, "Global Message Widget"),
                kiru.createElement("input", { id: "global-message-input", type: "text", "bind:value": globalMessage, placeholder: "Global message" }),
                kiru.createElement("div", { id: "global-message-display" },
                    "\"",
                    globalMessage.value,
                    "\"")),
            kiru.createElement("div", { id: "global-users" },
                kiru.createElement("h3", null, "Global Users Widget"),
                globalUsers.value.map((user) => (kiru.createElement("div", { key: user.id, id: `user-${user.id}` },
                    kiru.createElement("span", { className: `user-status ${user.online ? "online" : "offline"}` },
                        user.name,
                        " (",
                        user.online ? "Online" : "Offline",
                        ")"),
                    kiru.createElement("button", { className: "toggle-status", onclick: () => toggleUserStatus(user.id) }, "Toggle Status")))),
                kiru.createElement("div", { id: "users-stats" },
                    "Online Users: ",
                    onlineUsersCount.value)),
            kiru.createElement("div", { id: "global-log" },
                kiru.createElement("h3", null, "Global Activity Log"),
                kiru.createElement("div", { id: "global-log-output" }, globalLogs.value.length === 0 ? (kiru.createElement("div", null, "No global activity yet...")) : (globalLogs.value.map((log, index) => (kiru.createElement("div", { key: index, className: "global-log-entry" }, log))))),
                kiru.createElement("button", { id: "clear-global-log", onclick: () => (globalLogs.value = []) }, "Clear Global Log")),
            kiru.createElement("div", { id: "global-overview" },
                kiru.createElement("h3", null, "Global State Overview"),
                kiru.createElement("div", { id: "global-counter-value" },
                    "Counter: ",
                    globalCounter.value),
                kiru.createElement("div", { id: "global-counter-squared-value" },
                    "Counter\u00B2: ",
                    globalCounterSquared.value),
                kiru.createElement("div", { id: "global-message-length" },
                    "Message Length: ",
                    globalMessage.value.length,
                    " chars"),
                kiru.createElement("div", { id: "global-online-count" },
                    "Online Users: ",
                    onlineUsersCount.value)))));
}
//# sourceMappingURL=index.js.map