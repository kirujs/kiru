import { mount } from "kiru"
import { FileRouter } from "kiru/router"
import "./index.css"

mount(<FileRouter transition />, document.getElementById("app")!)
