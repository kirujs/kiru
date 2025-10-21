import { Signal, useSignal } from "kiru"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "x-app": {
        greeting: Signal<string>
      }
    }
  }
}

export default function WebComponentExample() {
  const greeting = useSignal("Hello world!")
  console.log("WebComponentExample")
  return (
    <div className="flex flex-col gap-2">
      <input bind:value={greeting} />
      <x-app greeting={greeting} />
    </div>
  )
}

if ("window" in globalThis) {
  const { $reactive, defineElement, html } = await import("x-templ")

  defineElement("x-app", {
    observedAttributes: ["greeting"],
    state: () => ({
      count: $reactive(0),
      toggled: $reactive(false),
    }),
    render() {
      const { count, toggled } = this.$state()

      const increment = () => count.set((prev) => prev + 1)

      return html`
        <h1 class="text-xl">${this.getAttribute("greeting")!}</h1>
        <button onclick="${() => toggled.set(!toggled.get())}">Toggle</button>
        ${toggled.get()
          ? html`<x-nested onIncrement="${increment}" count="${count.get()}" />`
          : ""}
      `
    },
  })

  defineElement("x-nested", {
    observedAttributes: ["count"],
    render() {
      return html`
        <button onclick="${() => this.$emit("increment")}">
          Nested Counter: ${this.getAttribute("count")!}
        </button>
        <x-nested-again />
      `
    },
  })

  defineElement("x-nested-again", {
    state: () => ({ count: $reactive(0) }),
    render() {
      const { count } = this.$state()
      return html`
        <button onclick="${() => count.set((prev) => prev + 1)}">
          Nested Again: ${count.get()}
        </button>
      `
    },
  })
}
