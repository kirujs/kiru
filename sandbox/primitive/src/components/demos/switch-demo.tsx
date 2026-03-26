import { computed, signal } from "kiru"
import { Switch } from "@kirujs/headless-ui"

export const SwitchDemo = () => {
  const checked = signal(false)
  const checkedText = computed(() => (checked.value ? "ON" : "OFF"))
  return () => (
    <div style="display:flex; flex-direction:column; gap:1.5rem">
      <div>
        <h3 style="margin-bottom:0.5rem">Controlled Switch</h3>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <Switch.Root checked={checked} className="switch">
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
          <label>Switch is {checkedText}</label>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Uncontrolled Switch (default on)</h3>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <Switch.Root defaultChecked className="switch">
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
          <label>Default checked</label>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Disabled Switch</h3>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <Switch.Root disabled className="switch">
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
          <label>Disabled (off)</label>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.5rem">
          <Switch.Root disabled defaultChecked className="switch">
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
          <label>Disabled (on)</label>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">With Form Name</h3>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <Switch.Root name="notifications" value="enabled" className="switch">
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
          <label>Enable notifications</label>
        </div>
      </div>
    </div>
  )
}
