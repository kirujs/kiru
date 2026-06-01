"use dom"

import {
  For,
  mount,
  setupDom,
  signal,
  type DomAppHandle,
  type Signal,
} from "kiru/dom"

export function mountWorkspace(container: HTMLElement): DomAppHandle {
  return mount(() => <WorkspaceApp />, container)
}

type Task = { id: number; text: string; done: boolean }
type Section = { id: number; name: string; tasks: Task[] }
type Filter = "all" | "open" | "done"

let nextTaskId = 10

function filterTasks(tasks: Task[], filter: Filter): Task[] {
  if (filter === "open") return tasks.filter((t) => !t.done)
  if (filter === "done") return tasks.filter((t) => t.done)
  return tasks
}

function WorkspaceApp() {
  const sections = signal<Section[]>([
    {
      id: 1,
      name: "Alpha",
      tasks: [
        { id: 1, text: "A1", done: false },
        { id: 2, text: "A2", done: true },
      ],
    },
    {
      id: 2,
      name: "Beta",
      tasks: [
        { id: 3, text: "B1", done: false },
        { id: 4, text: "B2", done: false },
      ],
    },
    {
      id: 3,
      name: "Gamma",
      tasks: [{ id: 5, text: "C1", done: true }],
    },
  ])
  const filter = signal<Filter>("all")
  const sectionExpanded = signal<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
  })

  function isSectionExpanded(sectionId: number): boolean {
    return sectionExpanded()[sectionId] ?? false
  }

  function toggleSection(sectionId: number) {
    const cur = sectionExpanded()
    sectionExpanded.set({
      ...cur,
      [sectionId]: !isSectionExpanded(sectionId),
    })
  }

  function moveSectionUp(sectionId: number) {
    const list = sections()
    const index = list.findIndex((s) => s.id === sectionId)
    if (index <= 0) return
    const next = [...list]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    sections.set(next)
  }

  function moveSectionDown(sectionId: number) {
    const list = sections()
    const index = list.findIndex((s) => s.id === sectionId)
    if (index === -1 || index === list.length - 1) return
    const next = [...list]
    ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
    sections.set(next)
  }

  function moveTaskInSection(sectionId: number, taskId: number, direction: "up" | "down") {
    sections.set(
      sections().map((section) => {
        if (section.id !== sectionId) return section
        const tasks = [...section.tasks]
        const index = tasks.findIndex((t) => t.id === taskId)
        if (index === -1) return section
        if (direction === "up" && index <= 0) return section
        if (direction === "down" && index >= tasks.length - 1) return section
        const swap = direction === "up" ? index - 1 : index + 1
        ;[tasks[index], tasks[swap]] = [tasks[swap]!, tasks[index]!]
        return { ...section, tasks }
      })
    )
  }

  function moveTaskToSection(
    taskId: number,
    fromSectionId: number,
    toSectionId: number
  ) {
    if (fromSectionId === toSectionId) return
    const list = sections()
    const from = list.find((s) => s.id === fromSectionId)
    if (!from) return
    const task = from.tasks.find((t) => t.id === taskId)
    if (!task) return
    sections.set(
      list.map((section) => {
        if (section.id === fromSectionId) {
          return {
            ...section,
            tasks: section.tasks.filter((t) => t.id !== taskId),
          }
        }
        if (section.id === toSectionId) {
          return { ...section, tasks: [...section.tasks, task] }
        }
        return section
      })
    )
  }

  function toggleTaskDone(sectionId: number, taskId: number, done: boolean) {
    sections.set(
      sections().map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              tasks: section.tasks.map((t) =>
                t.id === taskId ? { ...t, done } : t
              ),
            }
      )
    )
  }

  function addTaskToSection(sectionId: number, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const id = nextTaskId++
    sections.set(
      sections().map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              tasks: [
                ...section.tasks,
                { id, text: trimmed, done: false },
              ],
            }
      )
    )
  }

  return () => (
    <div data-testid="workspace-app">
      <nav className="workspace-filters" data-testid="workspace-filters">
        <button
          type="button"
          data-testid="filter-all"
          className={filter() === "all" ? "active" : ""}
          onclick={() => filter.set("all")}
        >
          All
        </button>
        <button
          type="button"
          data-testid="filter-open"
          className={filter() === "open" ? "active" : ""}
          onclick={() => filter.set("open")}
        >
          Open
        </button>
        <button
          type="button"
          data-testid="filter-done"
          className={filter() === "done" ? "active" : ""}
          onclick={() => filter.set("done")}
        >
          Done
        </button>
      </nav>
      <div
        className="workspace-inner"
        data-testid="workspace-inner"
        style="display: flex; flex-direction: column; gap: 0.5rem;"
      >
        <For each={sections} key={(section) => section.id}>
          {(section) => (
            <SectionColumn
              sectionId={section.id}
              sectionName={section.name}
              sections={sections}
              filter={filter}
              sectionExpanded={sectionExpanded}
              onToggle={() => toggleSection(section.id)}
              onMoveSectionUp={() => moveSectionUp(section.id)}
              onMoveSectionDown={() => moveSectionDown(section.id)}
              onMoveTaskUp={(taskId) =>
                moveTaskInSection(section.id, taskId, "up")
              }
              onMoveTaskDown={(taskId) =>
                moveTaskInSection(section.id, taskId, "down")
              }
              onMoveTaskToSection={moveTaskToSection}
              onToggleDone={(taskId, done) =>
                toggleTaskDone(section.id, taskId, done)
              }
              onAddTask={(text) => addTaskToSection(section.id, text)}
            />
          )}
        </For>
      </div>
    </div>
  )
}

type SectionColumnProps = {
  sectionId: number
  sectionName: string
  sections: Signal<Section[]>
  filter: Signal<Filter>
  sectionExpanded: Signal<Record<number, boolean>>
  onToggle: () => void
  onMoveSectionUp: () => void
  onMoveSectionDown: () => void
  onMoveTaskUp: (taskId: number) => void
  onMoveTaskDown: (taskId: number) => void
  onMoveTaskToSection: (
    taskId: number,
    fromSectionId: number,
    toSectionId: number
  ) => void
  onToggleDone: (taskId: number, done: boolean) => void
  onAddTask: (text: string) => void
}

function SectionColumn() {
  const { derive } = setupDom<SectionColumnProps>()
  const expanded = derive(
    (p) => p.sectionExpanded()[p.sectionId] ?? false
  )
  const canMovePrev = derive((p) => {
    const idx = p.sections().findIndex((s) => s.id === p.sectionId)
    return idx > 0
  })
  const canMoveNext = derive((p) => {
    const idx = p.sections().findIndex((s) => s.id === p.sectionId)
    return idx !== -1 && idx < p.sections().length - 1
  })

  return (props) => (
    <div className="section-column" data-section-id={props.sectionId}>
      <p className="section-spacer">{props.sectionId}</p>
      <div className="section-header">
        <h2 className="section-name">{props.sectionName}</h2>
        <button
          type="button"
          className="section-toggle"
          data-testid={`section-toggle-${props.sectionId}`}
          onclick={props.onToggle}
        >
          {expanded() ? "Collapse" : "Expand"}
        </button>
        {canMovePrev() && (
          <button
            type="button"
            className="section-move-up"
            data-testid={`section-move-up-${props.sectionId}`}
            onclick={props.onMoveSectionUp}
          >
            ↑
          </button>
        )}
        {canMoveNext() && (
          <button
            type="button"
            className="section-move-down"
            data-testid={`section-move-down-${props.sectionId}`}
            onclick={props.onMoveSectionDown}
          >
            ↓
          </button>
        )}
      </div>
      {expanded() && (
        <TaskPanel
          sectionId={props.sectionId}
          sections={props.sections}
          filter={props.filter}
          canMoveTaskToPrev={canMovePrev()}
          canMoveTaskToNext={canMoveNext()}
          onMoveTaskUp={props.onMoveTaskUp}
          onMoveTaskDown={props.onMoveTaskDown}
          onMoveTaskToSection={props.onMoveTaskToSection}
          onToggleDone={props.onToggleDone}
          onAddTask={props.onAddTask}
        />
      )}
    </div>
  )
}

type TaskPanelProps = {
  sectionId: number
  sections: Signal<Section[]>
  filter: Signal<Filter>
  canMoveTaskToPrev: boolean
  canMoveTaskToNext: boolean
  onMoveTaskUp: (taskId: number) => void
  onMoveTaskDown: (taskId: number) => void
  onMoveTaskToSection: (
    taskId: number,
    fromSectionId: number,
    toSectionId: number
  ) => void
  onToggleDone: (taskId: number, done: boolean) => void
  onAddTask: (text: string) => void
}

function TaskPanel() {
  const draft = signal("")
  const { derive } = setupDom<TaskPanelProps>()
  const tasks = derive((p) => {
    const section = p.sections().find((s) => s.id === p.sectionId)
    if (!section) return []
    return filterTasks(section.tasks, p.filter())
  })

  return (props) => (
    <div className="task-panel" data-section-id={props.sectionId}>
      <div className="task-add-row">
        <input
          type="text"
          className="task-input"
          placeholder="New task"
          bind:value={draft}
        />
        <button type="button" className="task-add" onclick={() => {
          props.onAddTask(draft())
          draft.set("")
        }}>
          Add
        </button>
      </div>
      <div className="task-list">
        <For
          each={tasks}
          key={(task) => task.id}
          fallback={<p className="task-empty">No tasks</p>}
        >
          {(task) => (
            <TaskRow
              task={task}
              sectionId={props.sectionId}
              sections={props.sections}
              canMoveToPrev={props.canMoveTaskToPrev}
              canMoveToNext={props.canMoveTaskToNext}
              onMoveTaskToSection={props.onMoveTaskToSection}
              onMoveUp={() => props.onMoveTaskUp(task.id)}
              onMoveDown={() => props.onMoveTaskDown(task.id)}
              onToggleDone={(done) => props.onToggleDone(task.id, done)}
            />
          )}
        </For>
      </div>
    </div>
  )
}

type TaskRowProps = {
  task: Task
  sectionId: number
  sections: Signal<Section[]>
  canMoveToPrev: boolean
  canMoveToNext: boolean
  onMoveTaskToSection: (
    taskId: number,
    fromSectionId: number,
    toSectionId: number
  ) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleDone: (done: boolean) => void
}

function TaskRow() {
  const noteCount = signal(0)

  return (props) => {
    function moveToPrevSection() {
      const ids = props.sections().map((s) => s.id)
      const idx = ids.indexOf(props.sectionId)
      if (idx > 0) {
        props.onMoveTaskToSection(
          props.task.id,
          props.sectionId,
          ids[idx - 1]!
        )
      }
    }

    function moveToNextSection() {
      const ids = props.sections().map((s) => s.id)
      const idx = ids.indexOf(props.sectionId)
      if (idx !== -1 && idx < ids.length - 1) {
        props.onMoveTaskToSection(
          props.task.id,
          props.sectionId,
          ids[idx + 1]!
        )
      }
    }

    return (
    <div className="task-row" data-task-id={props.task.id}>
      <span className="task-badge">{props.task.id}</span>
      <input
        type="checkbox"
        className="task-done"
        checked={props.task.done}
        onchange={(e) => {
          const checked = (e.target as HTMLInputElement).checked
          props.onToggleDone(checked)
        }}
      />
      <span className="task-text">{props.task.text}</span>
      <span className="task-note-count">{noteCount()}</span>
      <button
        type="button"
        className="note-increment"
        onclick={() => noteCount.set((n: number) => n + 1)}
      >
        +
      </button>
      <button type="button" className="task-move-up" onclick={props.onMoveUp}>
        ↑
      </button>
      <button type="button" className="task-move-down" onclick={props.onMoveDown}>
        ↓
      </button>
      {props.canMoveToPrev && (
        <button
          type="button"
          className="task-move-prev-section"
          onclick={moveToPrevSection}
        >
          ←
        </button>
      )}
      {props.canMoveToNext && (
        <button
          type="button"
          className="task-move-next-section"
          onclick={moveToNextSection}
        >
          →
        </button>
      )}
    </div>
    )
  }
}
