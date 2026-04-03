import { signal } from "kiru"
import { RadioGroup, type RadioGroupRootProps } from "@kirujs/headless-ui"

export const RadioGroupDemo = () => {
  const selected = signal("option-1")

  return () => (
    <div style="display:flex; flex-direction:column; gap:1.5rem">
      <div>
        <h3 style="margin-bottom:0.5rem">Controlled Radio Group</h3>
        <p style="margin-bottom:0.5rem">Selected: {selected}</p>
        <RadioGroupRoot
          value={selected}
          values={[
            { value: "option-1", display: "Option 1" },
            { value: "option-2", display: "Option 2" },
            { value: "option-3", display: "Option 3" },
          ]}
        />
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Horizontal Radio Group</h3>
        <RadioGroupRoot
          defaultValue="horizontal-2"
          orientation="horizontal"
          values={[
            { value: "horizontal-1", display: "H1" },
            { value: "horizontal-2", display: "H2" },
            { value: "horizontal-3", display: "H3" },
          ]}
        />
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">With Disabled Option</h3>
        <RadioGroupRoot
          defaultValue="enabled-1"
          values={[
            { value: "enabled-1", display: "Enabled 1" },
            { value: "disabled", display: "Disabled", disabled: true },
            { value: "enabled-2", display: "Enabled 2" },
          ]}
        />
      </div>
    </div>
  )
}

type GroupRootProps = RadioGroupRootProps & {
  values: { value: string; display: string; disabled?: boolean }[]
}

const RadioGroupRoot: Kiru.FC<GroupRootProps> = ({ values, ...props }) => (
  <RadioGroup.Root className="radio-group" {...props}>
    {values.map((item) => (
      <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">
        <RadioGroup.Item
          value={item.value}
          id={item.value}
          className="radio-item"
          disabled={item.disabled}
        >
          <RadioGroup.Indicator className="radio-indicator" />
        </RadioGroup.Item>
        <label htmlFor={item.value}>{item.display}</label>
      </div>
    ))}
  </RadioGroup.Root>
)
