import { memo, useEffect, useState } from "kiru"

export default function BigListExample() {
  const [toggle, setToggle] = useState(false)

  let startTime = performance.now()
  useEffect(() => {
    console.log("render big list", performance.now() - startTime)
  })

  const handleClick = () => {
    setToggle(!toggle)
    startTime = performance.now()
  }

  return (
    <div>
      <button className="fixed top-0 right-0" onclick={handleClick}>
        Toggle
      </button>
      <ul>
        <Items />
        {toggle && <article>One More!</article>}
      </ul>
    </div>
  )
}

const Items = memo(() => {
  console.log("render items")
  return (
    <>
      {Array.from({ length: 100e3 }).map((_, i) => (
        <li>{i}</li>
      ))}
    </>
  )
})
