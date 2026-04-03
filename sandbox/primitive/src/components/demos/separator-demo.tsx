import { Separator } from "@kirujs/headless-ui"

export const SeparatorDemo = () => {
  return () => (
    <div style="display:flex; flex-direction:column; gap:1.5rem;">
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <h3 style="margin:0">Horizontal Separator</h3>
        <div>Profile</div>
        <Separator className="separator" />
        <div>Billing</div>
        <Separator className="separator" />
        <div>Security</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <h3 style="margin:0">Vertical Separator</h3>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <a href="#">Home</a>
          <Separator orientation="vertical" className="separator separator-vertical" />
          <a href="#">Pricing</a>
          <Separator orientation="vertical" className="separator separator-vertical" />
          <a href="#">Docs</a>
        </div>
      </div>
    </div>
  )
}

