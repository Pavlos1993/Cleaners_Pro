import type { DraggableAttributes } from '@dnd-kit/core'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { addDays, format, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Icon } from '../components/Icon'
import { isBookingEvent } from '../lib/hosthub'
import {
  type BoardTask,
  type Priority,
  type PlanningWindow,
  type TaskColumn,
  type Cleaner,
  useAppStore,
  useBoardTasks,
} from '../store/appStore'

function priorityDot(p: BoardTask['priority']) {
  if (p === 'high') return 'bg-error'
  if (p === 'medium') return 'bg-amber-500'
  return 'bg-slate-300'
}

type DragBind = {
  setNodeRef: (node: HTMLElement | null) => void
  listeners: Record<string, unknown> | undefined
  attributes: DraggableAttributes
  isDragging: boolean
}

type PrintOptions = {
  managerSchedule: boolean
  cleanersSchedule: boolean
  /** When true, omit tasks marked done from printed schedules. */
  excludeDoneCleanings: boolean
  /** Inspector walk sheet: cleaner, property, same-day check-in, notes, linen tick boxes. */
  inspectorSheet: boolean
}

type AddManualCleaningForm = {
  rentalId: string
  column: TaskColumn
  priority: Priority
  note: string
}

function cleanerNameForColumn(column: TaskColumn, cleaners: Cleaner[]): string {
  if (column.startsWith('cleaner:')) {
    const id = column.slice('cleaner:'.length)
    return cleaners.find((c) => c.id === id)?.name ?? 'Cleaner'
  }
  return 'Unassigned'
}

function columnLabel(column: TaskColumn, cleaners: Cleaner[]): string {
  if (column === 'checkouts') return 'Checkouts (Cleanings)'
  if (column === 'turnovers') return 'Turnovers (Cleanings)'
  return cleanerNameForColumn(column, cleaners)
}

/** Title as printed / listed: carried tasks show original planned date. */
function printTaskDisplayTitle(task: BoardTask): string {
  if (!task.carriedOver) return task.title
  const plannedLabel = format(
    parseISO(`${task.plannedDate}T00:00:00`),
    'MMM d, yyyy',
  )
  return `${task.title} (CARRIED — planned ${plannedLabel})`
}

function TaskCardVisual({
  task,
  dragging,
  dragProps,
  onToggleDone,
  onOpen,
}: {
  task: BoardTask
  dragging?: boolean
  dragProps?: DragBind
  onToggleDone?: (taskId: string, done: boolean) => void
  onOpen?: (taskId: string) => void
}) {
  const border = 'border-tertiary-fixed-dim'
  const badgeColor = 'text-on-tertiary-container'

  return (
    <article
      ref={dragProps?.setNodeRef}
      {...(dragProps?.listeners ?? {})}
      {...(dragProps?.attributes ?? {})}
      onClick={() => onOpen?.(task.id)}
      className={clsx(
        'kanban-column rounded-xl border-l-[3px] bg-white p-4',
        border,
        'task-card-shadow transition-all',
        dragProps && 'cursor-grab hover:-translate-y-0.5 active:cursor-grabbing',
        dragging && 'opacity-60',
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'font-["Inter"] text-[11px] font-bold uppercase tracking-widest',
              badgeColor,
            )}
          >
            {task.badge}
          </span>
          {task.carriedOver && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              CARRIED
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-slate-400"
          onPointerDown={(ev) => ev.stopPropagation()}
        >
          <Icon name="more_vert" className="text-[18px]" />
        </button>
      </div>
      <h3 className="mb-1 font-['Manrope'] text-lg font-semibold text-slate-900">{task.title}</h3>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Planned {task.plannedDate}
      </div>
      {task.note && (
        <p className="mb-2 line-clamp-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
          {task.note}
        </p>
      )}
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon name="hourglass_empty" className="text-[16px]" />
        <span className="font-['Inter'] text-xs font-semibold tracking-wide">{task.timeLabel}</span>
      </div>
      {task.progress !== undefined && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-on-tertiary-container"
            style={{ width: `${Math.round(task.progress * 100)}%` }}
          />
        </div>
      )}
      {task.statusChip && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
          <div className="flex items-center gap-1.5 rounded bg-on-tertiary-container/10 px-2 py-0.5 text-[10px] font-bold text-on-tertiary-container">
            <Icon name="check_circle" filled className="text-[12px]" />
            {task.statusChip}
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              priorityDot(task.priority),
            )}
          />
          <span className="font-['Inter'] text-xs font-semibold text-slate-600">
            {task.priority === 'high' ? 'High Priority' : task.priority === 'medium' ? 'Medium' : 'Low Priority'}
          </span>
        </div>
        {onToggleDone && (
          <button
            type="button"
            className={clsx(
              'rounded-md px-2.5 py-1 text-[11px] font-semibold',
              task.done
                ? 'border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation()
              onToggleDone(task.id, !task.done)
            }}
            title={task.done ? 'Mark as not done' : 'Mark cleaning as done'}
          >
            {task.done ? '↺ Reopen' : '✓ Done'}
          </button>
        )}
      </div>
    </article>
  )
}

function TaskCard({
  task,
  onToggleDone,
  onOpen,
}: {
  task: BoardTask
  onToggleDone: (taskId: string, done: boolean) => void
  onOpen: (taskId: string) => void
}) {
  const drag = useDraggable({ id: task.id })
  return (
    <TaskCardVisual
      task={task}
      dragging={drag.isDragging}
      dragProps={drag}
      onToggleDone={onToggleDone}
      onOpen={onOpen}
    />
  )
}

function Column({
  column,
  title,
  count,
  icon,
  children,
  headerExtra,
}: {
  column: TaskColumn
  title: string
  count: number
  icon: string
  children: React.ReactNode
  headerExtra?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column}` })
  return (
    <section className="kanban-column flex max-h-full flex-col">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {headerExtra ?? (
            <Icon
              name={icon}
              className={clsx(
                'text-[20px]',
                column === 'checkouts' && 'text-secondary',
                column === 'turnovers' && 'text-on-tertiary-container',
              )}
            />
          )}
          <h2 className="font-['Manrope'] text-lg font-semibold text-on-surface">{title}</h2>
          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 font-['Inter'] text-xs font-semibold text-on-surface-variant">
            {count}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'no-scrollbar flex max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto rounded-xl p-1 transition-colors',
          isOver && 'bg-secondary/5 ring-2 ring-secondary/30',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function OperationsPage() {
  const boardTasks = useBoardTasks()
  const moveTask = useAppStore((s) => s.moveTask)
  const syncFromHosthub = useAppStore((s) => s.syncFromHosthub)
  const syncStatus = useAppStore((s) => s.syncStatus)
  const syncMessage = useAppStore((s) => s.syncMessage)
  const liveFromHosthub = useAppStore((s) => s.liveFromHosthub)
  const cleaners = useAppStore((s) => s.cleaners)
  const cleanerAvailabilityById = useAppStore((s) => s.cleanerAvailabilityById)
  const selectedBoardDate = useAppStore((s) => s.selectedBoardDate)
  const setSelectedBoardDate = useAppStore((s) => s.setSelectedBoardDate)
  const planningWindow = useAppStore((s) => s.planningWindow)
  const setPlanningWindow = useAppStore((s) => s.setPlanningWindow)
  const setTaskCompleted = useAppStore((s) => s.setTaskCompleted)
  const setTaskNote = useAppStore((s) => s.setTaskNote)
  const setTaskPriority = useAppStore((s) => s.setTaskPriority)
  const addManualCleaning = useAppStore((s) => s.addManualCleaning)
  const rentals = useAppStore((s) => s.rentals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showAddManualDialog, setShowAddManualDialog] = useState(false)
  const [manualPropertyQuery, setManualPropertyQuery] = useState('')
  const [printOptions, setPrintOptions] = useState<PrintOptions>({
    managerSchedule: true,
    cleanersSchedule: true,
    excludeDoneCleanings: false,
    inspectorSheet: false,
  })
  const [addManualForm, setAddManualForm] = useState<AddManualCleaningForm>({
    rentalId: '',
    column: 'checkouts',
    priority: 'medium',
    note: '',
  })
  const events = useAppStore((s) => s.events)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function cleanerActiveOnSelectedDate(cleanerId: string): boolean {
    const periods = cleanerAvailabilityById[cleanerId]
    if (!periods || periods.length === 0) return true
    return periods.some(
      (p) =>
        p.from <= selectedBoardDate &&
        (p.to === null || p.to >= selectedBoardDate),
    )
  }

  const columns: { id: TaskColumn; title: string; icon: string; headerExtra?: React.ReactNode }[] =
    useMemo(() => {
      const base: {
        id: TaskColumn
        title: string
        icon: string
        headerExtra?: React.ReactNode
      }[] = [
        { id: 'checkouts', title: 'Checkouts (Cleanings)', icon: 'logout' },
        { id: 'turnovers', title: 'Turnovers (Cleanings)', icon: 'cleaning_services' },
      ]
      for (const c of cleaners) {
        if (!cleanerActiveOnSelectedDate(c.id)) continue
        base.push({
          id: `cleaner:${c.id}`,
          title: c.name,
          icon: 'person',
          headerExtra: c.avatarUrl ? (
            <img
              src={c.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-secondary ring-2 ring-white shadow-sm">
              {c.name.slice(0, 1).toUpperCase()}
            </div>
          ),
        })
      }
      return base
    }, [cleaners, cleanerAvailabilityById, selectedBoardDate])
  const manualAssignmentColumns = useMemo(
    () => columns.map((c) => c.id),
    [columns],
  )

  const tasksByColumn = useMemo(() => {
    const m = new Map<TaskColumn, BoardTask[]>()
    for (const c of columns) m.set(c.id, [])
    for (const t of boardTasks) {
      const list = m.get(t.column) ?? []
      list.push(t)
      m.set(t.column, list)
    }
    for (const [k, v] of m.entries()) {
      m.set(
        k,
        [...v].sort((a, b) =>
          a.plannedDate === b.plannedDate
            ? a.title.localeCompare(b.title)
            : a.plannedDate.localeCompare(b.plannedDate),
        ),
      )
    }
    return m
  }, [boardTasks, columns])

  const activeTask = activeId ? boardTasks.find((t) => t.id === activeId) : undefined
  const openedTask = openedTaskId
    ? boardTasks.find((t) => t.id === openedTaskId)
    : undefined

  // Match visible board: same calendar day, plus carry-forward tasks (planned on an earlier
  // day but shown today with carriedOver; their plannedDate is not selectedBoardDate).
  const printDayTasks = useMemo(() => {
    let tasks = boardTasks.filter(
      (t) => t.plannedDate === selectedBoardDate || t.carriedOver,
    )
    if (printOptions.excludeDoneCleanings) {
      tasks = tasks.filter((t) => !t.done)
    }
    return tasks
  }, [boardTasks, selectedBoardDate, printOptions.excludeDoneCleanings])
  const cleanerPrintGroups = useMemo(
    () =>
      cleaners
        .map((cleaner) => ({
          cleaner,
          tasks: printDayTasks
            .filter((t) => t.column === `cleaner:${cleaner.id}`)
            .sort((a, b) => a.title.localeCompare(b.title)),
        }))
        .filter((group) => group.tasks.length > 0),
    [cleaners, printDayTasks],
  )
  const managerRows = useMemo(() => {
    const rows = cleanerPrintGroups.map((group) => ({
      cleanerName: group.cleaner.name,
      properties: group.tasks.map((t) => printTaskDisplayTitle(t)),
      tasks: group.tasks,
    }))
    const unassigned = printDayTasks
      .filter((t) => t.column === 'checkouts' || t.column === 'turnovers')
      .sort((a, b) => a.title.localeCompare(b.title))
    if (unassigned.length > 0) {
      rows.push({
        cleanerName: 'Unassigned',
        properties: unassigned.map((t) => printTaskDisplayTitle(t)),
        tasks: unassigned,
      })
    }
    return rows
  }, [cleanerPrintGroups, printDayTasks])

  const inspectorRows = useMemo(() => {
    const hasCheckInOnScheduleDate = (rentalId: string) =>
      events.some(
        (e) =>
          isBookingEvent(e) &&
          e.rental?.id === rentalId &&
          e.date_from === selectedBoardDate,
      )
    return [...printDayTasks]
      .map((task) => ({
        task,
        checkInSameDay: hasCheckInOnScheduleDate(task.rentalId),
      }))
      .sort((a, b) => {
        const na = cleanerNameForColumn(a.task.column, cleaners)
        const nb = cleanerNameForColumn(b.task.column, cleaners)
        if (na !== nb) return na.localeCompare(nb)
        return a.task.title.localeCompare(b.task.title)
      })
  }, [printDayTasks, events, selectedBoardDate, cleaners])

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    let column: TaskColumn | null = null
    const overId = String(over.id)
    if (overId.startsWith('col:')) column = overId.slice(4) as TaskColumn
    else {
      const hit = boardTasks.find((t) => t.id === overId)
      if (hit) column = hit.column
    }
    if (!column) return
    moveTask(String(active.id), column)
  }

  function printSelected() {
    if (
      !printOptions.managerSchedule &&
      !printOptions.cleanersSchedule &&
      !printOptions.inspectorSheet
    )
      return
    setShowPrintDialog(false)
    window.setTimeout(() => window.print(), 80)
  }

  function openAddManualDialog() {
    const firstRentalId = rentals[0]?.id ?? ''
    const firstColumn = manualAssignmentColumns[0] ?? 'checkouts'
    setAddManualForm({
      rentalId: firstRentalId,
      column: firstColumn,
      priority: 'medium',
      note: '',
    })
    setManualPropertyQuery('')
    setShowAddManualDialog(true)
  }

  function submitManualCleaning() {
    if (!addManualForm.rentalId) return
    addManualCleaning({
      rentalId: addManualForm.rentalId,
      plannedDate: selectedBoardDate,
      column: addManualForm.column,
      note: addManualForm.note,
      priority: addManualForm.priority,
    })
    setShowAddManualDialog(false)
  }

  const selectedDateLabel = format(
    parseISO(`${selectedBoardDate}T00:00:00`),
    'MMM d, yyyy',
  )
  const filteredManualRentals = useMemo(() => {
    const q = manualPropertyQuery.trim().toLowerCase()
    if (!q) return rentals
    return rentals.filter((r) => r.name.toLowerCase().includes(q))
  }, [rentals, manualPropertyQuery])

  // Keep rentalId in sync with visible options (native <select> can show the wrong row
  // when value is not among filtered <option>s).
  useEffect(() => {
    if (!showAddManualDialog) return
    if (filteredManualRentals.length === 0) {
      setAddManualForm((prev) =>
        prev.rentalId ? { ...prev, rentalId: '' } : prev,
      )
      return
    }
    const selectedVisible = filteredManualRentals.some(
      (r) => r.id === addManualForm.rentalId,
    )
    if (!selectedVisible) {
      setAddManualForm((prev) => ({
        ...prev,
        rentalId: filteredManualRentals[0].id,
      }))
    }
  }, [showAddManualDialog, filteredManualRentals, addManualForm.rentalId])
  const endDateLabel =
    planningWindow === 'day'
      ? selectedDateLabel
      : format(
          addDays(
            parseISO(`${selectedBoardDate}T00:00:00`),
            planningWindow === 'week' ? 6 : 29,
          ),
          'MMM d, yyyy',
        )

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="no-print sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="font-['Manrope'] text-lg font-extrabold text-slate-900">OpsBoard</h1>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(['day', 'week', 'month'] as PlanningWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setPlanningWindow(w)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-semibold capitalize',
                  planningWindow === w
                    ? 'bg-secondary text-white'
                    : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-2 py-1.5">
            <button
              type="button"
              className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
              onClick={() =>
                setSelectedBoardDate(
                  format(
                    addDays(parseISO(`${selectedBoardDate}T00:00:00`), -1),
                    'yyyy-MM-dd',
                  ),
                )
              }
              title="Previous day"
            >
              <Icon name="chevron_left" className="text-[16px]" />
            </button>
            <Icon name="calendar_today" className="text-[18px]" />
            <input
              type="date"
              value={selectedBoardDate}
              onChange={(e) => setSelectedBoardDate(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold tracking-wide"
            />
            <span className="hidden text-xs font-semibold text-slate-500 lg:inline">
              {planningWindow === 'day'
                ? selectedDateLabel
                : `${selectedDateLabel} → ${endDateLabel}`}
            </span>
            <button
              type="button"
              className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
              onClick={() =>
                setSelectedBoardDate(
                  format(
                    addDays(parseISO(`${selectedBoardDate}T00:00:00`), 1),
                    'yyyy-MM-dd',
                  ),
                )
              }
              title="Next day"
            >
              <Icon name="chevron_right" className="text-[16px]" />
            </button>
            <button
              type="button"
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setSelectedBoardDate(format(new Date(), 'yyyy-MM-dd'))}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => void syncFromHosthub()}
            disabled={syncStatus === 'syncing'}
            className="rounded-lg bg-secondary px-4 py-1.5 font-['Inter'] text-xs font-semibold text-on-secondary transition-opacity hover:opacity-90 disabled:opacity-50"
            title="Uses the key saved under Hosthub in the sidebar. Paste there first if you have not."
          >
            {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Hosthub'}
          </button>
          <button
            type="button"
            onClick={openAddManualDialog}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 font-['Inter'] text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:bg-red-300"
            disabled={rentals.length === 0}
            title={
              rentals.length === 0
                ? 'No properties available yet. Sync first.'
                : 'Add a manual cleaning for the selected date'
            }
          >
            <Icon name="add" className="text-[18px]" />
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowPrintDialog(true)}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-1.5 font-['Inter'] text-xs font-semibold text-on-secondary transition-opacity hover:opacity-90"
          >
            <Icon name="print" className="text-[18px]" />
            Print
          </button>
        </div>
      </header>

      {!liveFromHosthub && (
        <div className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-900">
          Sample data mode. Add your Hosthub API key under <strong>Hosthub</strong>, then use{' '}
          <strong>Save &amp; sync from Hosthub</strong>. This app only <strong>reads</strong> bookings from Hosthub;
          cleaner assignments never leave your browser.
        </div>
      )}
      {liveFromHosthub && (
        <div className="no-print border-b border-blue-200 bg-blue-50 px-6 py-2 text-center text-sm text-blue-950">
          Live Hosthub bookings (read-only). Properties come from Hosthub; add cleaners under{' '}
          <strong>Cleaners</strong> — drag assignments are stored locally only.
          {cleaners.length === 0 && (
            <span className="mt-1 block font-semibold text-amber-800">
              You have no cleaners yet — add at least one on the Cleaners page to assign turnovers.
            </span>
          )}
        </div>
      )}
      {syncMessage && (
        <div
          className={clsx(
            'no-print border-b px-6 py-2 text-center text-sm',
            syncStatus === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900',
          )}
        >
          {syncMessage}
        </div>
      )}

      <main className="flex flex-1 gap-4 overflow-x-auto p-6 print:hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          {columns.map((col) => (
            <Column
              key={col.id}
              column={col.id}
              title={col.title}
              icon={col.icon}
              headerExtra={col.headerExtra}
              count={tasksByColumn.get(col.id)?.length ?? 0}
            >
              {(tasksByColumn.get(col.id) ?? []).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleDone={(taskId, done) => setTaskCompleted(taskId, done)}
                  onOpen={(taskId) => setOpenedTaskId(taskId)}
                />
              ))}
              {col.id.startsWith('cleaner:') && (tasksByColumn.get(col.id) ?? []).length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-white/30 py-12">
                  <Icon name="task_alt" className="mb-2 text-[48px] text-slate-300" />
                  <p className="text-center font-['Inter'] text-xs font-semibold text-slate-400">
                    No tasks assigned for this date
                  </p>
                </div>
              )}
            </Column>
          ))}
          <DragOverlay>{activeTask ? <TaskCardVisual task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      </main>
      <section className="print-only hidden p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Daily Cleaning Schedule</h1>
          <p className="text-sm text-slate-600">{selectedDateLabel}</p>
        </div>

        {printOptions.managerSchedule && (
          <div
            className={clsx(
              (printOptions.cleanersSchedule || printOptions.inspectorSheet) &&
                'print-break-after-page',
            )}
          >
            <h2 className="mb-3 text-xl font-bold text-slate-900">Manager Schedule</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">
                    Cleaner
                  </th>
                  <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">
                    Assigned Properties (Day)
                  </th>
                  <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {managerRows.length === 0 && (
                  <tr>
                    <td
                      className="border border-slate-300 px-3 py-2 text-slate-500"
                      colSpan={3}
                    >
                      No cleanings for this day.
                    </td>
                  </tr>
                )}
                {managerRows.map((row) => (
                  <tr key={row.cleanerName}>
                    <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">
                      {row.cleanerName}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      {row.properties.join(', ')}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                      {row.tasks.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printOptions.cleanersSchedule &&
          (cleanerPrintGroups.length === 0 ? (
            <div>
              <h2 className="mb-2 text-xl font-bold text-slate-900">Cleaners Schedule</h2>
              <p className="text-sm text-slate-600">No assigned cleaner tasks for this day.</p>
            </div>
          ) : (
            cleanerPrintGroups.map((group) => (
              <article key={group.cleaner.id} className="print-break-after-page">
                <h2 className="mb-1 text-xl font-bold text-slate-900">
                  Cleaner: {group.cleaner.name}
                </h2>
                <p className="mb-4 text-sm text-slate-600">
                  Daily cleaning plan for {selectedDateLabel}
                </p>
                <div className="space-y-2">
                  {group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-slate-300 p-3"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-base font-semibold text-slate-900">{task.title}</p>
                        {task.carriedOver && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 print:bg-amber-50">
                            Carried
                          </span>
                        )}
                      </div>
                      {task.carriedOver && (
                        <p className="mt-0.5 text-xs font-medium text-amber-900">
                          Originally planned{' '}
                          {format(
                            parseISO(`${task.plannedDate}T00:00:00`),
                            'MMM d, yyyy',
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-600">
                        {task.badge} · {task.timeLabel} · Priority:{' '}
                        {task.priority[0].toUpperCase() + task.priority.slice(1)}
                      </p>
                      {task.note && (
                        <p className="mt-1 text-xs text-slate-700">Note: {task.note}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Status: {task.done ? 'Done' : 'Pending'}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ))}

        {printOptions.inspectorSheet && (
          <div
            className={clsx(
              (printOptions.managerSchedule || printOptions.cleanersSchedule) &&
                'print-break-before-page',
            )}
          >
            <h2 className="mb-1 text-xl font-bold text-slate-900">Inspector checklist</h2>
            <p className="mb-3 text-sm text-slate-600">
              {selectedDateLabel} — tick linen when verified. Same-day check-in is pre-marked ✓
              when a guest is scheduled to arrive this date at the property.
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">
                    Cleaner
                  </th>
                  <th className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">
                    Property
                  </th>
                  <th className="w-20 border border-slate-300 bg-slate-100 px-1 py-2 text-center text-xs font-semibold leading-tight">
                    Check-in same day
                  </th>
                  <th className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold">
                    Notes
                  </th>
                  <th className="w-16 border border-slate-300 bg-slate-100 px-1 py-2 text-center text-xs font-semibold">
                    New linen
                  </th>
                  <th className="w-16 border border-slate-300 bg-slate-100 px-1 py-2 text-center text-xs font-semibold">
                    Old linen
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspectorRows.length === 0 ? (
                  <tr>
                    <td
                      className="border border-slate-300 px-2 py-3 text-slate-500"
                      colSpan={6}
                    >
                      No cleanings for this day.
                    </td>
                  </tr>
                ) : (
                  inspectorRows.map(({ task, checkInSameDay }) => (
                    <tr key={task.id}>
                      <td className="border border-slate-300 px-2 py-2 align-top font-semibold text-slate-800">
                        {cleanerNameForColumn(task.column, cleaners)}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 align-top text-slate-800">
                        {printTaskDisplayTitle(task)}
                      </td>
                      <td className="border border-slate-300 px-1 py-2 align-middle text-center text-base">
                        {checkInSameDay ? '✓' : '☐'}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 align-top text-slate-700">
                        {task.note?.trim() ? task.note : '—'}
                      </td>
                      <td className="border border-slate-300 px-1 py-6 align-middle text-center text-slate-400">
                        ☐
                      </td>
                      <td className="border border-slate-300 px-1 py-6 align-middle text-center text-slate-400">
                        ☐
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {showAddManualDialog && (
        <div
          className="no-print fixed inset-0 z-[80] bg-black/30 p-4"
          onClick={() => setShowAddManualDialog(false)}
        >
          <div
            className="mx-auto mt-16 max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Manrope'] text-xl font-bold text-slate-900">
              Add manual cleaning
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Add a card for {selectedDateLabel}. If not done, it will carry forward like other
              tasks.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-semibold">Search property</span>
                <input
                  type="text"
                  value={manualPropertyQuery}
                  onChange={(e) => setManualPropertyQuery(e.target.value)}
                  placeholder="Type to filter properties..."
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-semibold">Property</span>
                <select
                  value={addManualForm.rentalId}
                  onChange={(e) =>
                    setAddManualForm((prev) => ({ ...prev, rentalId: e.target.value }))
                  }
                  disabled={filteredManualRentals.length === 0}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  {filteredManualRentals.length === 0 ? (
                    <option value="">No matching properties</option>
                  ) : (
                    filteredManualRentals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
                {manualPropertyQuery.trim() && filteredManualRentals.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    No properties matched your search. Clear the search or try another term.
                  </p>
                )}
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-semibold">Assign first to</span>
                <select
                  value={addManualForm.column}
                  onChange={(e) =>
                    setAddManualForm((prev) => ({
                      ...prev,
                      column: e.target.value as TaskColumn,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {manualAssignmentColumns.map((c) => (
                    <option key={c} value={c}>
                      {columnLabel(c, cleaners)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-semibold">Priority</span>
                <select
                  value={addManualForm.priority}
                  onChange={(e) =>
                    setAddManualForm((prev) => ({
                      ...prev,
                      priority: e.target.value as Priority,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-semibold">Notes</span>
                <textarea
                  value={addManualForm.note}
                  onChange={(e) =>
                    setAddManualForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="Optional note for cleaner..."
                  className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setShowAddManualDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                onClick={submitManualCleaning}
                disabled={!addManualForm.rentalId}
              >
                Add cleaning
              </button>
            </div>
          </div>
        </div>
      )}
      {showPrintDialog && (
        <div className="no-print fixed inset-0 z-[80] bg-black/30 p-4" onClick={() => setShowPrintDialog(false)}>
          <div
            className="mx-auto mt-16 max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Manrope'] text-xl font-bold text-slate-900">Print options</h3>
            <p className="mt-1 text-sm text-slate-600">
              Choose which schedule(s) to include for {selectedDateLabel}.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={printOptions.managerSchedule}
                  onChange={(e) =>
                    setPrintOptions((prev) => ({ ...prev, managerSchedule: e.target.checked }))
                  }
                />
                Manager schedule
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={printOptions.cleanersSchedule}
                  onChange={(e) =>
                    setPrintOptions((prev) => ({ ...prev, cleanersSchedule: e.target.checked }))
                  }
                />
                Cleaners
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={printOptions.excludeDoneCleanings}
                  onChange={(e) =>
                    setPrintOptions((prev) => ({
                      ...prev,
                      excludeDoneCleanings: e.target.checked,
                    }))
                  }
                />
                Do not include cleanings marked as done
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={printOptions.inspectorSheet}
                  onChange={(e) =>
                    setPrintOptions((prev) => ({
                      ...prev,
                      inspectorSheet: e.target.checked,
                    }))
                  }
                />
                Inspector checklist (linen &amp; same-day check-in)
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setShowPrintDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                onClick={printSelected}
                disabled={
                  !printOptions.managerSchedule &&
                  !printOptions.cleanersSchedule &&
                  !printOptions.inspectorSheet
                }
              >
                Print selected
              </button>
            </div>
          </div>
        </div>
      )}
      {openedTask && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 p-4"
          onClick={() => setOpenedTaskId(null)}
        >
          <div
            className="mx-auto mt-10 max-w-lg rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-['Manrope'] text-xl font-bold text-slate-900">
                  {openedTask.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {openedTask.badge} · Planned {openedTask.plannedDate}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setOpenedTaskId(null)}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Priority
                </p>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={clsx(
                        'rounded-md border px-3 py-1.5 text-xs font-semibold uppercase',
                        openedTask.priority === p
                          ? 'border-secondary bg-secondary text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                      )}
                      onClick={() => setTaskPriority(openedTask.id, p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Notes
                </p>
                <textarea
                  value={openedTask.note ?? ''}
                  onChange={(e) => setTaskNote(openedTask.id, e.target.value)}
                  placeholder="Add notes for cleaner..."
                  className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none ring-secondary-container focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-600">
                  {openedTask.done ? 'Marked as done' : 'Not done yet'}
                </span>
                <button
                  type="button"
                  onClick={() => setTaskCompleted(openedTask.id, !openedTask.done)}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-sm font-semibold',
                    openedTask.done
                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700',
                  )}
                >
                  {openedTask.done ? 'Reopen' : 'Mark done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
