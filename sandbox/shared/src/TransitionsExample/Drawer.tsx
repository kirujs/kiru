import { Portal, Transition, useRef, useState } from "kiru"
import { Button } from "../atoms/Button"
import { Backdrop } from "./Backdrop"
import { Header } from "./Header"

export function DrawerDemo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onclick={() => setOpen((v) => !v)}>Toggle Drawer</Button>
      <Portal container={document.getElementById("portal-root")!}>
        <Transition
          in={open}
          element={(state) => (
            <Drawer state={state} close={() => setOpen(false)} />
          )}
        />
      </Portal>
    </>
  )
}

type DrawerProps = {
  state: "entering" | "entered" | "exiting" | "exited"
  close: () => void
}

function Drawer({ state, close }: DrawerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  if (state == "exited") return null
  const opacity = state === "entered" ? "1" : "0"
  const offsetY = state === "entered" ? 0 : 15
  return (
    <Backdrop
      ref={wrapperRef}
      onclick={(e) => e.target === wrapperRef.current && close()}
      style={{ opacity }}
    >
      <div
        className="drawer-content"
        style={{ transform: `translateY(${offsetY}%)` }}
      >
        <Header>Drawer</Header>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam
          voluptatem, quas, quos, quod voluptate voluptates dolorum
          reprehenderit natus quibusdam ratione quia! Quisquam, quod. Quisquam
          voluptatem, quas, quos, quod voluptate voluptates dolorum
          reprehenderit natus quibusdam ratione quia! Quisquam, quod. Quisquam
          voluptatem, quas, quos, quod voluptate voluptates dolorum
          reprehenderit natus quibusdam ratione quia! Quisquam, quod.
        </p>
      </div>
    </Backdrop>
  )
}
