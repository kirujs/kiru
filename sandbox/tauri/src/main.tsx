import "./styles.css"
import { mount } from "kiru"

const App = () => {
  return (
    <div>
      <h1>hello</h1>
    </div>
  )
}

mount(<App />, document.getElementById("app")!)
