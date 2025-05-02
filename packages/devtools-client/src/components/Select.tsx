import { ElementProps } from "kaioken"

type Key = string | number

type SelectOption =
  | {
      key: Key
      text: string
      disabled?: boolean
    }
  | string

interface SelectProps {
  value?: string
  options: SelectOption[]
  onChange?: (value: string) => void
}

export function Select(
  props: SelectProps & Omit<ElementProps<"select">, "onchange">
) {
  const { className, value, onChange, options, ...rest } = props

  return (
    <select
      className={className}
      onchange={(e) => onChange?.(e.target.value)}
      {...rest}
    >
      {props.options.map((item) => {
        const key = typeof item === "object" ? String(item.key) : item
        const disabled = typeof item === "object" && item.disabled
        return (
          <option
            value={key}
            selected={value?.toString() === key}
            disabled={disabled}
          >
            {typeof item === "object" ? item.text : item}
          </option>
        )
      })}
    </select>
  )
}
