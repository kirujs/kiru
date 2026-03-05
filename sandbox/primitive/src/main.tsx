import "./style.css"
import { mount } from "kiru"
import { Counter } from "./counter"

const App = () => (
  <div>
    <h1>Hello World</h1>
    <Counter />
  </div>
)

mount(<App />, document.getElementById("app")!)
