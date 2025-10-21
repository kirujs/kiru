import { useSignal, useWatch } from "kiru"

export default function ElementBindingsExample() {
  return (
    <div className="flex flex-col gap-2">
      <TextInput />
      <RangeInput />
      <NumberInput />
      <DateInput />
      <TextArea />
      <Checkbox />
      <Details />
      <Dialog />
      <Audio />
      <Video />
      <Select />
      <MultipleSelect />
    </div>
  )
}

function Select() {
  const selected = useSignal("A")
  useWatch(() => console.log("Select", selected.value))
  return (
    <select bind:value={selected}>
      <option value="A">A</option>
      <option value="B">B</option>
      <option value="C">C</option>
    </select>
  )
}

function MultipleSelect() {
  const values = useSignal(["A", "B"])
  useWatch(() => console.log("MultipleSelect", values.value))
  return (
    <select multiple bind:value={values}>
      <option value="A">A</option>
      <option value="B">B</option>
      <option value="C">C</option>
    </select>
  )
}

// const input = document.createElement("input")
// input.value

function TextInput() {
  const text = useSignal("")
  useWatch(() => console.log("Input", text.value))
  return (
    <>
      <input type="text" bind:value={text} />
      <input type="text" bind:value={text} />
    </>
  )
}

function RangeInput() {
  const percent = useSignal(0)
  useWatch(() => console.log("Range", percent.value))
  return <input type="range" bind:value={percent} />
}

function NumberInput() {
  const num = useSignal(0)
  useWatch(() => console.log("Number", num.value))
  return <input type="number" bind:value={num} />
}

function DateInput() {
  const date = useSignal(new Date().toISOString().split("T")[0])
  useWatch(() => console.log("Date", date.value))
  // @ts-ignore unsure why but ts prevents us from building this although it is fine
  return <input type="date" bind:value={date} />
}

function TextArea() {
  const value = useSignal("")
  useWatch(() => console.log("TextArea", value.value))
  return <textarea bind:value={value} />
}

function Checkbox() {
  const checked = useSignal(true)
  useWatch(() => console.log("Checkbox", checked.value))
  return <input type="checkbox" bind:checked={checked} />
}

function Details() {
  const open = useSignal(false)
  useWatch(() => console.log("Details", open.value))
  return (
    <div className="flex gap-2">
      <button onclick={() => (open.value = !open.value)}>toggle details</button>
      <details bind:open={open}>
        <summary>open</summary>
        hidden content
      </details>
    </div>
  )
}

function Dialog() {
  const open = useSignal(true)
  useWatch(() => console.log("Dialog", open.value))
  return (
    <>
      <button onclick={() => (open.value = !open.value)}>toggle dialog</button>
      <dialog bind:open={open} className="bg-neutral-300 text-neutral-800 p-4">
        <p>Greetings, one and all!</p>
        <form method="dialog">
          <button>OK</button>
        </form>
      </dialog>
    </>
  )
}

function Audio() {
  const volume = useSignal(0.5)
  const currentTime = useSignal(0)
  const playbackRate = useSignal(1)
  useWatch(() => console.log("Audio.volume", volume.value))
  useWatch(() => console.log("Audio.currentTime", currentTime.value))
  useWatch(() => console.log("Audio.playbackRate", playbackRate.value))
  return (
    <>
      <audio
        bind:volume={volume}
        bind:currentTime={currentTime}
        bind:playbackRate={playbackRate}
        src="/doo-diddily-doo.mp3"
        controls
        loop
      />
      <audio
        bind:volume={volume}
        bind:currentTime={currentTime}
        bind:playbackRate={playbackRate}
        src="/doo-diddily-doo.mp3"
        controls
        loop
      />
    </>
  )
}

function Video() {
  const currentTime = useSignal(0)
  const playbackRate = useSignal(1)
  useWatch(() => console.log("Video.currentTime", currentTime.value))
  useWatch(() => console.log("Video.playbackRate", playbackRate.value))
  return (
    <>
      <video
        bind:currentTime={currentTime}
        bind:playbackRate={playbackRate}
        src="/flower.webm"
        controls
        loop
      />
      <video
        bind:currentTime={currentTime}
        bind:playbackRate={playbackRate}
        src="/flower.webm"
        controls
        loop
      />
    </>
  )
}
