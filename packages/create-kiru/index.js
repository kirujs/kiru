#!/usr/bin/env node
import fs from "node:fs"
import degit from "degit"
import { program } from "commander"
import { spawn } from "node:child_process"
import { execa } from "execa"
import inquirer from "inquirer"

const pieces = process.argv[1]?.split("/") || []
let executingPackageManager = "npm"
if (pieces.find((x) => x.includes("pnpm"))) {
  executingPackageManager = "pnpm"
} else if (pieces.find((x) => x.includes("yarn"))) {
  executingPackageManager = "yarn"
} else if (pieces.find((x) => x.includes("bun"))) {
  executingPackageManager = "bun"
}

const templates = [
  {
    name: "CSR",
    description: "Client-side rendering",
    value: "https://github.com/kirujs/kiru-csr-template.git",
  },
  {
    name: "SSG",
    description: "Static site generation",
    value: "https://github.com/kirujs/kiru-ssg-template.git",
  },
  {
    name: "SSR",
    description: "Server-side rendering with Vike",
    value: "https://github.com/kirujs/kiru-ssr-template.git",
  },
  {
    name: "Tauri",
    description: "Webview-based Desktop application",
    value: "https://github.com/kirujs/kiru-tauri-template.git",
  },
]

program
  .name("create-kiru")
  .description(
    "A command-line tool for quickly creating Kiru applications from a template."
  )
  .version("0.0.9", "-v, --version", "output the current version")
  .usage("[options]")
  .option("-d, --dir <dir>", "Destination directory")
  .option(
    "-t, --template <template>",
    "Choose template (available options: CSR, SSG, SSR, Tauri)"
  )
  .option("-i, --install", "Install dependencies")
  .option("-s, --start", "Start the app")
  .option("-h, --help", "Show help")
  .action(async ({ dir, template, install, start, help }) => {
    console.log("[create-kiru]: Welcome!")
    if (help) {
      console.log(program.helpInformation())
      return
    }
    let templateOption
    if (template) {
      template = template.toLowerCase()
      const match = templates.find((t) => t.name.toLowerCase() === template)

      if (!match) {
        console.error(`[create-kiru]: Invalid template.
Available templates: ${templates.map((t) => t.name).join(", ")}.
Exiting...`)
        return
      }

      console.log(
        `[create-kiru]: Using template: ${match.name} (${match.description})`
      )

      templateOption = match
    }

    if (!dir) {
      const { selectedDir } = await inquirer.prompt([
        {
          type: "input",
          name: "selectedDir",
          message:
            "Where should we create your project? \n(default: current directory)",
          default: ".",
        },
      ])
      dir = selectedDir
    }

    // if it's a directory, ensure it is empty
    if (fs.existsSync(dir)) {
      const stats = fs.statSync(dir)
      if (!stats.isDirectory()) {
        console.error(`[create-kiru]: ${dir} is not a directory. Exiting...`)
        return
      }

      const files = fs.readdirSync(dir)
      if (files.length > 0) {
        console.error(`[create-kiru]: ${dir} is not empty. Exiting...`)
        return
      }
    }

    if (!templateOption) {
      const { selectedTemplate } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedTemplate",
          message: "Which template do you want to use?",
          choices: templates,
        },
      ])

      const match = templates.find((t) => t.value === selectedTemplate)

      if (!match) {
        console.error("[create-kiru]: Invalid template. Exiting...")
        return
      }

      templateOption = match
    }

    try {
      const emitter = degit(`${templateOption.value}#main`)
      emitter.on("info", (info) => {
        console.log("[create-kiru]:", info.message)
      })

      await emitter.clone(dir)
    } catch (error) {
      console.error(
        `[create-kiru]: An error occurred while cloning the template:`,
        error
      )
      return
    }

    if (!install) {
      const { installNow } = await inquirer.prompt([
        {
          type: "confirm",
          name: "installNow",
          message: `Do you want to install the dependencies now? (Detected package manager: ${executingPackageManager})`,
          default: true,
        },
      ])

      if (!installNow) {
        console.log(
          `[create-kiru]: Configuration complete. Run \`${executingPackageManager} install\` in ${dir} to install them.`
        )
        return
      }
    }

    try {
      console.log(`[create-kiru]: Installing dependencies...`)
      const stream = execa({
        shell: true,
        windowsHide: false,
      })`cd ${dir} && ${executingPackageManager} install`.readable()

      stream.on("data", (d) => console.log(d.toString()))
      await new Promise((resolve) => stream.on("end", resolve))

      console.log(`[create-kiru]: Dependencies installed successfully!`)
    } catch (error) {
      console.error(
        `[create-kiru]: An error occurred while installing dependencies:`,
        error
      )
      return
    }

    let runDevCommand = `${executingPackageManager} dev`
    if (executingPackageManager === "npm") {
      runDevCommand = `npm run dev`
    }

    if (!start) {
      const { startNow } = await inquirer.prompt([
        {
          type: "confirm",
          name: "startNow",
          message: "Do you want to run the project now?",
          default: true,
        },
      ])
      if (!startNow) {
        console.log(
          `[create-kiru]: Configuration complete. Run \`${runDevCommand}\` in ${dir} to start the app.`
        )
        return
      }
    }

    try {
      console.log(`[create-kiru]: Running Vite dev server...`)
      const args = executingPackageManager === "npm" ? ["run", "dev"] : ["dev"]
      const child = spawn(executingPackageManager, [...args, "--", "--open"], {
        shell: true,
        windowsHide: false,
        cwd: dir,
      })
      child.stdout.on("data", (d) => console.log(d.toString()))
      child.stderr.on("data", (d) => console.log(d.toString()))
      process.on("SIGINT", () => {
        child.kill("SIGINT")
        console.log(`[create-kiru]: Vite dev server stopped.`)
        process.exit(0)
      })
    } catch (error) {
      console.error(
        `[create-kiru]: An error occurred while running dev server:`,
        error
      )
    }
  })

program.parse(process.argv)
