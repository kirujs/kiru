```tsx
<div>
  <p key="1">Foo</p>
  <p key="1">Bar</p>
</div>
// or:
const items = [
  { name: "Foo", id: "d1ac4a44-4da2-4584-9265-10fb714025d6" },
  { name: "Bar", id: "d1ac4a44-4da2-4584-9265-10fb714025d6" }
  // note the duplicate id!
]
<div>
  {items.map((item) => (
    <h1 key={item.id}>{item.name}</h1>
  ))}
</div>
```
