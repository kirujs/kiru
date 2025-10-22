import "./styles.css"
import { mount } from "kiru"
import { FileRouter } from "kiru/router"

mount(<FileRouter />, document.getElementById("app")!)
