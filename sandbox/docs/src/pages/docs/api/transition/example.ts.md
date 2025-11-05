```tsx
import { useState, Transition } from "kiru"

function App() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col">
      <button onclick={() => setExpanded((prev) => !prev)}>Show More</button>

      <Transition
        in={expanded}
        duration={300}
        // alternatively:
        // duration={{
        //  in: 300,
        //  out: 300
        //}}
        onTransitionEnd={(state) => console.log("Transition ended", state)}
        element={(state) => {
          if (state === "exited") return null
          return <DetailsView opacity={state === "entered" ? "1" : "0"} />
        }}
      />
    </div>
  )
}

function DetailsView({ opacity }: { opacity: string }) {
  return (
    <p style={{ transition: "all .3s ease", opacity }}>
      Some more information 🧠
    </p>
  )
}
```
