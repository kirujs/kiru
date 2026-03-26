import { computed, signal } from "kiru"
import { Slider } from "@kirujs/headless-ui"

export const SliderDemo = () => {
  const singleValue = signal(50)
  const multipleValues = signal([25, 50, 75])
  const multipleValuesText = computed(() => multipleValues.value.join(", "))
  const randomizeControlled = () => {
    singleValue.value = Math.floor(Math.random() * 100)
  }
  return () => (
    <div style="display:flex; flex-direction:column; gap:2rem">
      <div>
        <h3 style="margin-bottom:0.5rem">Single Value Slider</h3>
        <p style="margin-bottom:1rem">Value (controlled): {singleValue}</p>
        <button onclick={randomizeControlled}>Randomize</button>
        <Slider.Root value={singleValue} step={10} className="slider" dir="rtl">
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" />
        </Slider.Root>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Multiple Values Slider</h3>
        <p style="margin-bottom:1rem">Values: {multipleValuesText}</p>
        <Slider.Root
          value={multipleValues}
          dir="rtl"
          mode="multiple"
          className="slider"
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb
            index={0}
            className="slider-thumb"
            style="background:red;"
          />
          <Slider.Thumb
            index={1}
            className="slider-thumb"
            style="background:green"
          />
          <Slider.Thumb
            index={2}
            className="slider-thumb"
            style="background:blue"
          />
        </Slider.Root>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Custom Range (0-10, step 0.5)</h3>
        <Slider.Root
          defaultValue={5}
          min={0}
          max={10}
          step={0.5}
          className="slider"
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" />
        </Slider.Root>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Vertical Slider</h3>
        <div style="height:200px">
          <Slider.Root
            defaultValue={[25, 50, 75]}
            mode="multiple"
            orientation="vertical"
            className="slider slider-vertical"
          >
            <Slider.Track className="slider-track">
              <Slider.Range className="slider-range" />
            </Slider.Track>
            <Slider.Thumb
              index={0}
              className="slider-thumb"
              style="background:red;"
            />
            <Slider.Thumb
              index={1}
              className="slider-thumb"
              style="background:green"
            />
            <Slider.Thumb
              index={2}
              className="slider-thumb"
              style="background:blue"
            />
          </Slider.Root>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom:0.5rem">Disabled Slider</h3>
        <Slider.Root defaultValue={30} disabled className="slider">
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" />
        </Slider.Root>
      </div>
    </div>
  )
}
