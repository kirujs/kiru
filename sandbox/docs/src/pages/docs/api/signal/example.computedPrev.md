```ts
const websocket = computed((prev) => {
  prev?.close()
  // ^ Websocket | undefined
  return new WebSocket(`ws://localhost:3000/rooms/${userName}`)
})
```
