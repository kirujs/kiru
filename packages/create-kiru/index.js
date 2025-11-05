#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { simpleGit } from "simple-git"
import { program } from "commander"
import inquirer from "inquirer"
import { execa } from "execa"

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
    name: "CSR (Client-side rendering)",
    value: "https://github.com/kirujs/kiru-csr-template.git",
  },
  {
    name: "SSG (Static site generation)",
    value: "https://github.com/kirujs/kiru-ssg-template.git",
  },
  {
    name: "SSR (Server-side rendering) with Vike",
    value: "https://github.com/kirujs/kiru-ssr-template.git",
  },
  {
    name: "Tauri (Webview-based Desktop app)",
    value: "https://github.com/kirujs/kiru-tauri-template.git",
  },
]

const defaultDir = "."

program
  .option("-d, --dest <dest>", "Destination directory")
  .option("-t, --template <template>", "Choose template")
  .action(async ({ dest, template }) => {
    console.log("[create-kiru]: Welcome!\n")
    if (!dest) {
      const { selectedDest } = await inquirer.prompt([
        {
          type: "input",
          name: "selectedDest",
          message:
            "Where should we create your project? \n(default: current directory)",
          default: defaultDir,
        },
      ])
      dest = selectedDest
    }

    // if the folder exists already and contains files, ask if it should be overwritten
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest)
      if (stats.isDirectory()) {
        const destChildren = fs.readdirSync(dest)
        if (destChildren.length > 0) {
          const { overwrite } = await inquirer.prompt([
            {
              type: "list",
              name: "overwrite",
              message:
                "The folder already exists and is not empty. \nIn order to proceed, it will be deleted. Do you want to continue?",
              choices: [
                {
                  name: "Yes",
                  value: "y",
                },
                {
                  name: "No",
                  value: "n",
                },
              ],
            },
          ])
          if (overwrite === "n") return

          for (const file of destChildren) {
            const filePath = path.join(dest, file)
            fs.rmSync(filePath, { recursive: true, force: true })
          }
        }
      } else if (stats.isFile()) {
        const { overwrite } = await inquirer.prompt([
          {
            type: "list",
            name: "overwrite",
            message:
              "There is already a file at the destination. \nIn order to proceed, it will be deleted. Do you want to continue?",
            choices: [
              {
                name: "Yes",
                value: "y",
              },
              {
                name: "No",
                value: "n",
              },
            ],
          },
        ])
        if (overwrite === "n") return
        fs.rmSync(dest, { recursive: true, force: true })
      } else {
        throw new Error(
          `[create-kiru]: Unknown file type at ${dest}. Exiting...`
        )
      }
    }

    let templateUrl = ""
    if (!template) {
      const { selectedTemplate } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedTemplate",
          message: "Which template do you want to use?",
          choices: templates,
        },
      ])
      templateUrl = selectedTemplate
    } else {
      templateUrl = templates.find((t) => t.value === template)?.value || ""
    }
    const isValidTemplate = templates.some((t) => t.value === templateUrl)
    if (!isValidTemplate) {
      console.error("[create-kiru]: Invalid template. Exiting...")
      return
    }

    console.log(`Downloading project template '${templateUrl}'...`)
    try {
      await simpleGit().clone(templateUrl, dest)
      fs.rmSync(`${dest}/.git`, { recursive: true, force: true })
      simpleGit(dest).init()
    } catch (error) {
      console.error(
        `[create-kiru]: An error occurred while cloning the template:`,
        error
      )
      return
    }

    const availablePackageManagers = await detectPackageManager()

    const { packageManager } = await inquirer.prompt([
      {
        type: "list",
        name: "packageManager",
        message: "Which package manager do you want to use?",
        choices: availablePackageManagers,
        default: executingPackageManager,
      },
    ])

    let devCmd
    if (packageManager === "pnpm") {
      devCmd = "pnpm dev"
    } else if (packageManager === "yarn") {
      devCmd = "yarn dev"
    } else if (packageManager === "bun") {
      devCmd = "bun dev"
    } else {
      devCmd = "npm run dev"
    }
    console.log(`[create-kiru]: Project template downloaded. Get started by running the following:
    
    
  cd ${dest}
  ${packageManager} install
  ${devCmd}
`)
  })

program.parse(process.argv)

const detectPackageManager = async () => {
  const [hasYarn, hasPnpm, hasBun] = await Promise.all([
    hasGlobalInstallation("yarn"),
    hasGlobalInstallation("pnpm"),
    hasGlobalInstallation("bun"),
  ])

  const packageManagers = []
  if (hasPnpm) packageManagers.push("pnpm")
  if (hasYarn) packageManagers.push("yarn")
  if (hasBun) packageManagers.push("bun")
  packageManagers.push("npm") // npm as fallback

  const currentPmIdx = packageManagers.indexOf(executingPackageManager)
  // shift it to the start
  packageManagers.unshift(...packageManagers.splice(currentPmIdx, 1))
  return packageManagers
}

/**
 * Check if a global pm is available
 * @param {string} pm
 * @returns {Promise<boolean>}
 */
function hasGlobalInstallation(pm) {
  return execa(pm, ["--version"])
    .then((res) => {
      return /^\d+.\d+.\d+$/.test(res.stdout)
    })
    .catch(() => false)
}
