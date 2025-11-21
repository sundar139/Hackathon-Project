"use client"

import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import api from "@/lib/api"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Clock } from "lucide-react"

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
  estimated_minutes?: number
}

interface ScheduleViewProps {
  date: Date
  blocks: BlockItem[]
  assignments: AssignmentItem[]
}

export function ScheduleView({ date, blocks, assignments }: ScheduleViewProps) {
  const [editing, setEditing] = useState<{ kind: 'assignment' | 'task' | 'break'; block?: BlockItem; assignment?: AssignmentItem } | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDue, setEditDue] = useState("")
  const [editImportance, setEditImportance] = useState("")

  const blocksForDate = blocks.filter(b => b.start_at && new Date(b.start_at!).toDateString() === date.toDateString())
  const assignmentsForDate = assignments.filter(a => a.due_at && new Date(a.due_at!).toDateString() === date.toDateString())

  const hours = Array.from({ length: 24 }, (_, i) => i)

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
  }

  

  const getPosition = (iso?: string) => {
    if (!iso) return 0
    const d = new Date(iso)
    return d.getHours() + d.getMinutes() / 60
  }
  const getBlockPosition = (b: BlockItem) => getPosition(b.start_at)
  const getBlockDuration = (b: BlockItem) => {
    const s = b.start_at ? new Date(b.start_at).getTime() : 0
    const e = b.end_at ? new Date(b.end_at).getTime() : s + 30 * 60 * 1000
    const minutes = (e - s) / (1000 * 60)
    return Math.max(minutes, 15)
  }
  const palette = ['bg-rose-500','bg-indigo-500','bg-emerald-500','bg-amber-500','bg-sky-500','bg-violet-500','bg-cyan-500','bg-fuchsia-500']
  const colorForTitle = (title?: string) => {
    if (!title) return 'bg-rose-500'
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash) + title.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % palette.length
    return palette[idx]
  }
  const getBlockColor = (type?: string, title?: string) => {
    const t = (type || '').toUpperCase()
    if (t === 'EVENT') {
      return colorForTitle(title)
    }
    switch (t) {
      case 'STUDY': return 'bg-orange-500'
      case 'BREAK': return 'bg-green-500'
      case 'EXAM': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }
  const getPriorityColor = (level?: string) => {
    switch ((level || '').toLowerCase()) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-orange-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const [hoverInfo, setHoverInfo] = useState<{ top: number; title: string; time: string } | null>(null)
  const [hoverHour, setHoverHour] = useState<number | null>(null)
  const hideTimer = useRef<number | null>(null)

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
              </div>
              <div className="flex-1 relative">
                {blocksForDate
                  .filter(b => Math.floor(getBlockPosition(b)) === hour)
                  .map((b) => {
                    const pos = getBlockPosition(b)
                    const top = (pos % 1) * 48
                    const start = b.start_at ? new Date(b.start_at) : null
                    const end = b.end_at ? new Date(b.end_at) : null
                    const time = `${start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}${end ? ` → ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                    return (
                      <div key={`block-${b.id}`} className="absolute left-0 right-0" style={{ top }}>
                        <div
                          className={`h-[6px] w-[20%] ${getBlockColor(b.type, b.title)} rounded-sm cursor-pointer mx-auto`}
                          onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } setHoverInfo({ top, title: b.title || 'Event', time }); setHoverHour(hour) }}
                          onMouseLeave={() => { hideTimer.current = window.setTimeout(() => { setHoverInfo(null); setHoverHour(null) }, 120) }}
                          onClick={() => openEditBlock(b)}
                        />
                      </div>
                    )
                  })}
                {assignmentsForDate
                  .filter(a => Math.floor(getPosition(a.due_at)) === hour)
                  .map((a) => {
                    const pos = getPosition(a.due_at)
                    const top = (pos % 1) * 48
                    const due = a.due_at ? new Date(a.due_at) : null
                    const time = due ? due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                    return (
                      <div key={`assignment-${a.id}`} className="absolute left-0 right-0" style={{ top }}>
                        <div
                          className={`h-[6px] w-[20%] ${getPriorityColor(a.importance_level)} rounded-sm cursor-pointer mx-auto`}
                          onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } setHoverInfo({ top, title: a.title, time }); setHoverHour(hour) }}
                          onMouseLeave={() => { hideTimer.current = window.setTimeout(() => { setHoverInfo(null); setHoverHour(null) }, 120) }}
                          onClick={() => openEditAssignment(a)}
                        />
                      </div>
                    )
                  })}
                {hoverInfo && hoverHour === hour && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-white border rounded-md shadow p-2 text-xs pointer-events-none"
                    style={{ top: hoverInfo.top - 14 }}
                  >
                    <div className="font-medium truncate max-w-[220px]">{hoverInfo.title}</div>
                    <div className="opacity-70">{hoverInfo.time}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
              <DateTimePicker className="col-span-3" value={editDue} onChange={(v) => setEditDue(v)} />
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