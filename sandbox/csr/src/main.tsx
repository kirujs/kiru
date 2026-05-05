import { mount } from "kiru"
import "./index.css"

const App = () => {
  return (
    <div>
      <h1>hello</h1>
    </div>
  )
}

mount(<App />, document.getElementById("app")!)
