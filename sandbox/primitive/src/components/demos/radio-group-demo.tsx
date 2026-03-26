import { signal } from "kiru"
import { RadioGroup } from "@kirujs/headless-ui"

export const RadioGroupDemo = () => {
  const selected = signal("option-1")

  return () => (
    <div style="display:flex; flex-direction:column; gap:1.5rem">
      <div>
        <h3 style="margin-bottom:0.5rem">Controlled Radio Group</h3>
        <p style="margin-bottom:0.5rem">Selected: {selected}</p>
        <RadioGroup.Root value={selected} className="radio-group">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">
            <RadioGroup.Item value="option-1" className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Option 1</label>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">
            <RadioGroup.Item value="option-2" className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Option 2</label>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem">
            <RadioGroup.Item value="option-3" className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Option 3</label>
          </div>
        </RadioGroup.Root>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Horizontal Radio Group</h3>
        <RadioGroup.Root
          defaultValue="horizontal-2"
          orientation="horizontal"
          className="radio-group"
        >
          <div style="display:flex; gap:1rem">
            <div style="display:flex; align-items:center; gap:0.5rem">
              <RadioGroup.Item value="horizontal-1" className="radio-item">
                <RadioGroup.Indicator className="radio-indicator" />
              </RadioGroup.Item>
              <label>H1</label>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem">
              <RadioGroup.Item value="horizontal-2" className="radio-item">
                <RadioGroup.Indicator className="radio-indicator" />
              </RadioGroup.Item>
              <label>H2</label>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem">
              <RadioGroup.Item value="horizontal-3" className="radio-item">
                <RadioGroup.Indicator className="radio-indicator" />
              </RadioGroup.Item>
              <label>H3</label>
            </div>
          </div>
        </RadioGroup.Root>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">With Disabled Option</h3>
        <RadioGroup.Root defaultValue="enabled-1" className="radio-group">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">
            <RadioGroup.Item value="enabled-1" className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Enabled 1</label>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem">
            <RadioGroup.Item value="disabled" disabled className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Disabled Option</label>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem">
            <RadioGroup.Item value="enabled-2" className="radio-item">
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <label>Enabled 2</label>
          </div>
        </RadioGroup.Root>
      </div>
    </div>
  )
}
