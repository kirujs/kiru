```tsx
// the following is valid:
<div>
  <p>Foo</p>
  <p key="1">Bar</p>
</div>
// but this is not:
const items = [
  { name: "Foo", id: "d1ac4a44-4da2-4584-9265-10fb714025d6" },
  { name: "Bar" }
  // note the missing id!
]
<div>
  {items.map((item) => (
    <h1 key={item.id}>{item.name}</h1>
  ))}
</div>
```
