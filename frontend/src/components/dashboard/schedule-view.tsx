"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import api from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface BlockItem {
    id: number
    title: string
    start_at?: string
    end_at?: string
    type?: string
    status?: string
    importance_level?: string
}

interface AssignmentItem {
    id: number
    title: string
    due_at?: string
    importance_level?: string
    course_id?: number
}

interface ScheduleBlock {
    id: number
    title: string
    start_at: string
    end_at: string
    type: string
    status: string
    source: string
}

interface ScheduleViewProps {
    date: Date
    blocks: BlockItem[]
    assignments: AssignmentItem[]
}

export function ScheduleView({ date, blocks, assignments }: ScheduleViewProps) {
    tasks: Assignment[]
    scheduleBlocks?: ScheduleBlock[]
}

export function ScheduleView({ date, tasks, scheduleBlocks = [] }: ScheduleViewProps) {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const [editing, setEditing] = useState<{ kind: 'assignment' | 'task' | 'break'; block?: BlockItem; assignment?: AssignmentItem } | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [editDue, setEditDue] = useState("")
    const [editImportance, setEditImportance] = useState("")

    const blocksForDate = blocks.filter(b => {
        const base = b.start_at
        if (!base) return false
        const d = new Date(base)
        return d.toDateString() === date.toDateString()
    })
    const assignmentsForDate = assignments
        .filter(a => {
            const base = a.due_at
            if (!base) return false
            const d = new Date(base)
            return d.toDateString() === date.toDateString()
        })
        .filter(a => typeof a.course_id === 'number' && a.course_id > 0)
        .filter(a => {
            const t = String(a.title || '').toLowerCase()
            const relax = ['break', 'walk', 'meditation', 'limit screen time', 'rest', 'nap', 'breathe', 'breathing', 'stretch', 'snack', 'exercise']
            return !relax.some(w => t.includes(w))
        })

    const getTaskPosition = (task: { start_at?: string; due_at?: string }) => {
        const base = task.start_at || task.due_at || new Date(date).toISOString()
        const taskDate = new Date(base)
    const blocksForDate = scheduleBlocks.filter(block => {
        const blockDate = new Date(block.start_at)
        return blockDate.toDateString() === date.toDateString()
    })

    const getTaskPosition = (task: Assignment) => {
        const taskDate = new Date(task.due_at)
        const hour = taskDate.getHours()
        const minutes = taskDate.getMinutes()
        return hour + minutes / 60
    }

    const fmtHM = (iso?: string) => {
        if (!iso) return ""
        const d = new Date(iso)
        const h = d.getHours()
        const m = d.getMinutes()
        const hh = h % 12 === 0 ? 12 : h % 12
        const ap = h < 12 ? 'AM' : 'PM'
        return `${hh}:${String(m).padStart(2, '0')}${ap}`
    }
    const categorize = (title?: string, typeHint?: string) => {
        const t = String(title || '').toLowerCase()
        const hint = String(typeHint || '').toLowerCase()
        const breakWords = ['break', 'walk', 'meditation', 'limit screen time', 'rest', 'nap', 'breathe', 'breathing', 'stretch', 'snack', 'exercise']
        if (hint === 'break') return 'break'
        if (breakWords.some(w => t.includes(w))) return 'break'
        return 'task'
    }

    const toLocalInput = (iso?: string) => {
        if (!iso) return ""
        const d = new Date(iso)
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const toBackendIso = (local: string) => {
        if (!local) return undefined as unknown as string
        const d = new Date(local)
        const tz = d.getTimezoneOffset()
        const sign = tz <= 0 ? "+" : "-"
        const abs = Math.abs(tz)
        const offH = String(Math.floor(abs / 60)).padStart(2, "0")
        const offM = String(abs % 60).padStart(2, "0")
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offH}:${offM}`
    }
    const openEditBlock = (b: BlockItem) => {
        const kind: 'task' | 'break' = (String(b.type).toUpperCase() === 'BREAK') ? 'break' : 'task'
        setEditing({ kind, block: b })
        setEditTitle(b.title || "")
        setEditDue(toLocalInput(b.start_at))
        setEditImportance(b.importance_level || "")
    }
    const openEditAssignment = (a: AssignmentItem) => {
        setEditing({ kind: 'assignment', assignment: a })
        setEditTitle(a.title || "")
        setEditDue(toLocalInput(a.due_at))
        setEditImportance(a.importance_level || "")
    }
    const handleSave = async () => {
        if (!editing) return
        try {
            if (editing.kind === 'assignment' && editing.assignment) {
                await api.put(`/assignments/${editing.assignment.id}`, {
                    title: editTitle,
                    due_at: toBackendIso(editDue),
                    importance_level: editImportance || undefined,
                })
            } else if (editing.block) {
                await api.delete(`/schedule/${editing.block.id}`)
                await api.post('/schedule/', {
                    title: editTitle,
                    start_at: toBackendIso(editDue),
                    end_at: toBackendIso(editDue),
                    type: editing.kind === 'break' ? 'BREAK' : 'STUDY',
                    status: 'PLANNED'
                })
            }
            setEditing(null)
            try { window.dispatchEvent(new CustomEvent('assignmentUpdated')) } catch {}
        } catch {}
    }
    const handleDelete = async () => {
        if (!editing) return
        try {
            if (editing.kind === 'assignment' && editing.assignment) {
                await api.delete(`/assignments/${editing.assignment.id}`)
            } else if (editing.block) {
                await api.delete(`/schedule/${editing.block.id}`)
            }
            setEditing(null)
            try { window.dispatchEvent(new CustomEvent('assignmentUpdated')) } catch {}
        } catch {}
    const getBlockPosition = (block: ScheduleBlock) => {
        const blockDate = new Date(block.start_at)
        const hour = blockDate.getHours()
        const minutes = blockDate.getMinutes()
        return hour + minutes / 60
    }

    const getBlockDuration = (block: ScheduleBlock) => {
        const start = new Date(block.start_at).getTime()
        const end = new Date(block.end_at).getTime()
        return (end - start) / (1000 * 60) // Duration in minutes
    }

    const getBlockColor = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'STUDY': return 'bg-blue-100 border-blue-300 text-blue-700'
            case 'EVENT': return 'bg-purple-100 border-purple-300 text-purple-700'
            case 'BREAK': return 'bg-green-100 border-green-300 text-green-700'
            case 'EXAM': return 'bg-red-100 border-red-300 text-red-700'
            default: return 'bg-gray-100 border-gray-300 text-gray-700'
        }
    }

    const getPriorityColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'high': return 'bg-red-100 border-red-300 text-red-700'
            case 'medium': return 'bg-blue-100 border-blue-300 text-blue-700'
            case 'low': return 'bg-green-100 border-green-300 text-green-700'
            default: return 'bg-gray-100 border-gray-300 text-gray-700'
        }
    }

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm h-full flex flex-col overflow-hidden">
            <div className="mb-3 flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Schedule</h2>
                <p className="text-xs text-gray-600">
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="space-y-0">
                    {hours.map((hour) => (
                        <div key={hour} className="flex border-b border-gray-100 h-12">
                            <div className="w-24 flex-shrink-0 text-xs text-gray-600 pr-2 pt-1">
                                <div>{hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}</div>
                                {(() => {
                                    const inHour = (d: Date) => d.getHours() === hour
                                    const breakTimes = blocksForDate
                                        .filter(b => b.start_at && inHour(new Date(b.start_at)) && categorize(b.title, b.type) === 'break')
                                        .map(b => new Date(b.start_at!))
                                    const taskTimes = blocksForDate
                                        .filter(b => b.start_at && inHour(new Date(b.start_at)) && categorize(b.title, b.type) !== 'break')
                                        .map(b => new Date(b.start_at!))
                                    const asgTimes = assignmentsForDate
                                        .filter(a => a.due_at && inHour(new Date(a.due_at)))
                                        .map(a => new Date(a.due_at!))
                                    const all = [...breakTimes, ...taskTimes, ...asgTimes]
                                    const filtered = all.filter(d => d.getMinutes() !== 0)
                                    if (!filtered.length) return null
                                    const times = filtered
                                        .sort((a, b) => a.getTime() - b.getTime())
                                        .map(d => {
                                            const h = d.getHours(); const m = d.getMinutes(); const hh = h % 12 === 0 ? 12 : h % 12; const ap = h < 12 ? 'AM' : 'PM'; return `${hh}:${String(m).padStart(2, '0')}${ap}`
                                        })
                                    return (
                                        <div className="text-[10px] text-black leading-tight mt-0.5">
                                            {times.join(', ')}
                            <div className="w-16 flex-shrink-0 text-xs text-gray-500 pr-2 pt-1">
                                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                            </div>
                            <div className="flex-1 relative">
                                {/* Schedule Blocks */}
                                {blocksForDate
                                    .filter(block => Math.floor(getBlockPosition(block)) === hour)
                                    .map((block) => {
                                        const position = getBlockPosition(block)
                                        const duration = getBlockDuration(block)
                                        return (
                                            <div
                                                key={`block-${block.id}`}
                                                className={cn(
                                                    "absolute left-0 right-0 mx-1 p-1.5 rounded-lg border-l-2 text-xs",
                                                    getBlockColor(block.type)
                                                )}
                                                style={{
                                                    top: `${((position % 1) * 48)}px`,
                                                    height: `${Math.min(duration / 60 * 48, 48)}px`
                                                }}
                                            >
                                                <p className="font-medium truncate text-xs">{block.title || 'Event'}</p>
                                                <p className="text-[10px] opacity-70 flex items-center gap-0.5 mt-0.5">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {Math.round(duration)}m
                                                </p>
                                            </div>
                                        )
                                    })}
                                {/* Assignment Tasks */}
                                {tasksForDate
                                    .filter(task => Math.floor(getTaskPosition(task)) === hour)
                                    .map((task) => (
                                        <div
                                            key={`task-${task.id}`}
                                            className={cn(
                                                "absolute left-0 right-0 mx-1 p-1.5 rounded-lg border-l-2 text-xs",
                                                getPriorityColor(task.importance_level)
                                            )}
                                            style={{
                                                top: `${((getTaskPosition(task) % 1) * 48)}px`,
                                                height: `${Math.min((task.estimated_minutes || 30) / 60 * 48, 48)}px`
                                            }}
                                        >
                                            <p className="font-medium truncate text-xs">{task.title}</p>
                                            {task.estimated_minutes && (
                                                <p className="text-[10px] opacity-70 flex items-center gap-0.5 mt-0.5">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {task.estimated_minutes}m
                                                </p>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="relative">
                                    {(() => {
                                        const hourBreaks = blocksForDate
                                            .filter(b => Math.floor(getTaskPosition({ start_at: b.start_at }) ) === hour && categorize(b.title, b.type) === 'break')
                                            .sort((a, b) => new Date(a.start_at || '').getTime() - new Date(b.start_at || '').getTime())
                                        return hourBreaks.map((b, idx) => (
                                            <div key={`break-${b.id}`} className="absolute left-1" style={{ top: `${((getTaskPosition({ start_at: b.start_at }) % 1) * 48) + (idx * 16)}px`, width: '96px' }}>
                                                <div className="group h-[8px] rounded-full bg-blue-500 z-10" onClick={() => openEditBlock(b)}>
                                                    <div className="absolute z-50 hidden group-hover:block -top-9 left-0 min-w-[220px] rounded-md border bg-blue-50 text-blue-700 border-blue-200 shadow-md px-2 py-1">
                                                        <div className="text-[11px] font-semibold">Break</div>
                                                        <div className="text-[11px]">{b.title || 'Break'}</div>
                                                        <div className="text-[10px]">{fmtHM(b.start_at)}</div>
                                                    </div>
                                                </div>
                                                {/* no inline time; times appear in left column */}
                                            </div>
                                        ))
                                    })()}
                                </div>
                                <div className="relative">
                                    {(() => {
                                        const hourTasks = blocksForDate
                                            .filter(b => Math.floor(getTaskPosition({ start_at: b.start_at }) ) === hour && categorize(b.title, b.type) !== 'break')
                                            .sort((a, b) => new Date(a.start_at || '').getTime() - new Date(b.start_at || '').getTime())
                                        return hourTasks.map((b, idx) => (
                                            <div key={`task-${b.id}`} className="absolute left-1" style={{ top: `${((getTaskPosition({ start_at: b.start_at }) % 1) * 48) + (idx * 16)}px`, width: '96px' }}>
                                                <div className="group h-[8px] rounded-full bg-green-500 z-10" onClick={() => openEditBlock(b)}>
                                                    <div className="absolute z-50 hidden group-hover:block -top-9 left-0 min-w-[220px] rounded-md border bg-green-50 text-green-700 border-green-200 shadow-md px-2 py-1">
                                                        <div className="text-[11px] font-semibold">Task</div>
                                                        <div className="text-[11px]">{b.title || 'Task'}</div>
                                                        <div className="text-[10px]">{fmtHM(b.start_at)}</div>
                                                    </div>
                                                </div>
                                                {/* no inline time; times appear in left column */}
                                            </div>
                                        ))
                                    })()}
                                </div>
                                <div className="relative">
                                    {(() => {
                                        const hourAssignments = assignmentsForDate
                                            .filter(a => Math.floor(getTaskPosition({ due_at: a.due_at }) ) === hour)
                                            .sort((a, b) => new Date(a.due_at || '').getTime() - new Date(b.due_at || '').getTime())
                                        return hourAssignments.map((a, idx) => (
                                            <div key={`assignment-${a.id}`} className="absolute left-1" style={{ top: `${((getTaskPosition({ due_at: a.due_at }) % 1) * 48) + (idx * 16)}px`, width: '96px' }}>
                                                <div className="group h-[8px] rounded-full bg-red-500 z-10" onClick={() => openEditAssignment(a)}>
                                                    <div className="absolute z-50 hidden group-hover:block -top-9 left-0 min-w-[220px] rounded-md border bg-red-50 text-red-700 border-red-200 shadow-md px-2 py-1">
                                                        <div className="text-[11px] font-semibold">Assignment</div>
                                                        <div className="text-[11px]">{a.title}</div>
                                                        <div className="text-[10px]">{fmtHM(a.due_at)}</div>
                                                    </div>
                                                </div>
                                                {/* no inline time; times appear in left column */}
                                            </div>
                                        ))
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {(blocksForDate.length + assignmentsForDate.length) === 0 && (
                {tasksForDate.length === 0 && blocksForDate.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-sm">No tasks scheduled</p>
                    </div>
                )}
            </div>
            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{editing?.kind === 'assignment' ? 'Edit Assignment' : editing?.kind === 'break' ? 'Edit Breaks' : 'Edit Task'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="grid grid-cols-4 items-center gap-2">
                            <Label className="text-right">Title</Label>
                            <Input className="col-span-3" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-2">
                            <Label className="text-right">{editing?.kind === 'assignment' ? 'Due' : 'Start'}</Label>
                            <Input type="datetime-local" className="col-span-3" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-2">
                            <Label className="text-right">Importance</Label>
                            <Input className="col-span-3" value={editImportance} onChange={(e) => setEditImportance(e.target.value)} placeholder="low | medium | high" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
