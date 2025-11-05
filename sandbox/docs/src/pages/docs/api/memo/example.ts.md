```tsx
import { memo } from "kiru"

type User = {
  name: string
  avatarUrl: string
}

const MemoizedUserAvatar = memo(({ name, avatarUrl }: User) => {
  // Component logic here
  return (
    <div className="user-avatar">
      <img src={avatarUrl} alt={`${name}'s avatar`} />
      <span>{name}</span>
    </div>
  )
})
```
