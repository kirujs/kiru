```tsx
import { memo } from "kiru"

const MemoizedUserAvatar = memo(({ name, avatarUrl }) => {
  // Component logic here
  return (
    <div className="user-avatar">
      <img src={avatarUrl} alt={`${name}'s avatar`} />
      <span>{name}</span>
    </div>
  )
})
```
