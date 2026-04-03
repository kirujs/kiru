import type { StyleObject } from "kiru"

export const HIDDEN_INPUT_STYLES: StyleObject = {
  position: "absolute",
  pointerEvents: "none",
  opacity: 0,
  margin: 0,
  transform: "translateX(-100%)",
  width: "25px",
  height: "25px",
}
