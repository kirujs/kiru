import {
  Portal,
  Transition,
  useRef,
  useState,
  type TransitionState,
} from "kiru"
import { Button } from "../atoms/Button"
import { Backdrop } from "./Backdrop"
import { Header } from "./Header"

export function ModalDemo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onclick={() => setOpen((v) => !v)}>Toggle Modal</Button>
      <Portal container={document.getElementById("portal-root")!}>
        <Transition
          in={open}
          element={(state) => (
            <Modal state={state} close={() => setOpen(false)} />
          )}
        />
      </Portal>
    </>
  )
}

type ModalProps = {
  state: TransitionState
  close: () => void
}

function Modal({ state, close }: ModalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  if (state == "exited") return null
  const opacity = state === "entered" ? "1" : "0"
  const scale = state === "entered" ? 1 : 0.85
  const translateY = state === "entered" ? -50 : -25
  return (
    <Backdrop
      ref={wrapperRef}
      onclick={(e) => e.target === wrapperRef.current && close()}
      style={{ opacity }}
    >
      <div
        className="modal-content"
        style={{
          transform: `translate(-50%, ${translateY}%) scale(${scale})`,
        }}
      >
        <Header>Modal</Header>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam
          voluptatem, quas, quos, quod voluptate voluptates dolorum
          reprehenderit natus quibusdam ratione quia! Quisquam, quod.
        </p>
      </div>
    </Backdrop>
  )
}
