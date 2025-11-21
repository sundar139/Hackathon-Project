"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { Plus, Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import api from "@/lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Assignment {
    id: number
    title: string
    description?: string
    due_at: string
    status: string
    difficulty: string
    source_type: string
    user_confidence: number
    importance_level: string
    course_id?: number
    created_at?: string
}

export default function AssignmentsPage() {
    const router = useRouter()
    const token = useAuthStore(state => state.token)
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [courses, setCourses] = useState<Array<{ id: number; name: string; code?: string }>>([])
    const [scheduleBlocks, setScheduleBlocks] = useState<Array<{ id: number; title: string; start_at: string; end_at: string; type?: string; assignment_id?: number; importance_level?: string }>>([])
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newAssignment, setNewAssignment] = useState({
        title: "",
        course_id: "",
        due_at: "",
        difficulty: "Medium",
        status: "NOT_STARTED",
        source_type: "manual",
        user_confidence: 3,
        importance_level: "medium"
    })
    const [newAssignmentCourseText, setNewAssignmentCourseText] = useState<string>("")
    
    const [allTasksQuery, setAllTasksQuery] = useState<string>("")
    const [allAssignmentsQuery, setAllAssignmentsQuery] = useState<string>("")
    const [assignmentsSortBy, setAssignmentsSortBy] = useState<"due" | "importance">("due")
    const [assignmentsCourseFilter, setAssignmentsCourseFilter] = useState<string>("")
    const [hoursPerDay, setHoursPerDay] = useState<number>(2)
    const [hoursPerDayInput, setHoursPerDayInput] = useState<string>("2")
    const [hoursPerDayError, setHoursPerDayError] = useState<string | null>(null)
    const [allowWeekends, setAllowWeekends] = useState<boolean>(true)
    const [isPlanning, setIsPlanning] = useState<boolean>(false)
    const [importText, setImportText] = useState("")
    const [rawImportText, setRawImportText] = useState("")
    const [importFileName, setImportFileName] = useState("")
    const [plannerAssignmentId, setPlannerAssignmentId] = useState<number | null>(null)
    const [plannerAssignmentTitle, setPlannerAssignmentTitle] = useState<string>("")
    const [divideMode, setDivideMode] = useState<"subtasks" | "one">("subtasks")
    const [scheduleMode, setScheduleMode] = useState<"ai" | "manual">("ai")
    const [plannedSubtasks, setPlannedSubtasks] = useState<Array<{ id: number; title: string; estimated_minutes: number; start_at?: string; end_at?: string }>>([])
    const [suggestedTimes, setSuggestedTimes] = useState<Array<{ start_at: string; end_at: string }>>([])
    const [planningStep, setPlanningStep] = useState<'none' | 'choices' | 'subtasks' | 'one'>('none')
    const [editingSubtaskIds, setEditingSubtaskIds] = useState<number[]>([])
    const [isOneGoEditing, setIsOneGoEditing] = useState<boolean>(false)
    const [oneGoSuggestion, setOneGoSuggestion] = useState<{ start_at: string; end_at: string; duration_min: number } | null>(null)
    
    const [singleManualStart, setSingleManualStart] = useState<string>("")
    const [singleManualEnd, setSingleManualEnd] = useState<string>("")
    const toTitleCase = (s: string | undefined | null) => {
        const t = String(s || "").toLowerCase()
        return t.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
    }
    const downloadAssignments = (format: "json" | "csv", items: Assignment[]) => {
        if (format === "json") {
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "assignments.json"
            a.click()
            URL.revokeObjectURL(url)
            return
        }
        const headers = ["id","title","course_id","due_at","importance_level","status","user_confidence"]
        const rows = items.map(a => [a.id, a.title, a.course_id ?? "", a.due_at, a.importance_level, a.status, a.user_confidence])
        const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "assignments.csv"
        a.click()
        URL.revokeObjectURL(url)
    }

    
    const courseLabel = (id?: number) => {
        if (!id) return "N/A"
        const c = courses.find(x => x.id === id)
        if (!c) return String(id)
        return c.code ? `${c.code} - ${c.name}` : c.name
    }

    const resolveCourseId = async (courseText: string): Promise<number | undefined> => {
        const text = (courseText || "").trim()
        if (!text) return undefined
        const match = courses.find(c => c.name.toLowerCase() === text.toLowerCase() || (c.code || "").toLowerCase() === text.toLowerCase() || `${c.code ? c.code + " - " : ""}${c.name}`.toLowerCase() === text.toLowerCase())
        if (match) return match.id
        try {
            const parts = text.split("-")
            const code = parts.length > 1 ? parts[0].trim() : undefined
            const name = parts.length > 1 ? parts.slice(1).join("-").trim() : text
            const res = await api.post("/courses/", { name, code })
            const created = res?.data as { id: number }
            await fetchCourses()
            return created?.id
        } catch {
            return undefined
        }
    }
    const getAllAssignmentsList = () => {
        const filtered = assignments
            .filter(a => (String(a.importance_level || '').toLowerCase() !== 'low'))
            .filter(a => !(/break|study/i.test(String(a.title || ''))))
            .filter(a => {
                if (!allAssignmentsQuery.trim()) return true
                const q = allAssignmentsQuery.toLowerCase()
                return a.title?.toLowerCase().includes(q)
            })
            .filter(a => {
                if (!assignmentsCourseFilter.trim()) return true
                const lbl = courseLabel(a.course_id).toLowerCase()
                return lbl.includes(assignmentsCourseFilter.toLowerCase())
            })
        const sorted = filtered.slice().sort((a, b) => {
            if (assignmentsSortBy === "importance") {
                const rank = { critical: 3, high: 2, medium: 1, low: 0 } as Record<string, number>
                const ai = rank[String(a.importance_level || '').toLowerCase()] ?? 0
                const bi = rank[String(b.importance_level || '').toLowerCase()] ?? 0
                return bi - ai
            }
            return new Date(b.due_at).getTime() - new Date(a.due_at).getTime()
        })
        return sorted
    }

    const handleImportFile = async (file: File | null) => {
        try {
            if (!file) return
            setImportFileName(file.name)
            const name = file.name.toLowerCase()
            const type = (file.type || "").toLowerCase()
            if (type.startsWith("text/") || name.endsWith(".md") || name.endsWith(".txt")) {
                const text = await file.text()
                setRawImportText(text)
                return
            }
            if (name.endsWith(".docx") || type.includes("openxmlformats-officedocument.wordprocessingml.document")) {
                try {
                    const { default: mammoth } = await import("mammoth")
                    const buffer = await file.arrayBuffer()
                    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
                    const text = String(result?.value || "").replace(/\s+/g, " ").trim()
                    setRawImportText(text)
                    return
                } catch {
                    const text = await file.text().catch(() => "")
                    setRawImportText(text || "")
                    return
                }
            }
            if (name.endsWith(".pdf") || type.includes("pdf")) {
                try {
                    const pdfjsLib = await import("pdfjs-dist")
                    // @ts-expect-error: worker provided by Next.js build
                    pdfjsLib.GlobalWorkerOptions.workerSrc = undefined
                    const buffer = await file.arrayBuffer()
                    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
                    let full = ""
                    const getStr = (it: unknown): string => {
                        const obj = it as { str?: unknown }
                        return typeof obj.str === "string" ? obj.str : ""
                    }
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i)
                        const content = await page.getTextContent()
                        const strings = (Array.isArray(content?.items) ? content.items : [])
                            .map(getStr)
                            .filter((s) => s !== "")
                        full += strings.join(" ") + "\n"
                    }
                    const text = full.replace(/\s+/g, " ").trim()
                    setRawImportText(text)
                    return
                } catch {
                    const text = await file.text().catch(() => "")
                    setRawImportText(text || "")
                    return
                }
            }
            const fallback = await file.text().catch(() => "")
            setRawImportText(fallback || "")
        } catch {}
    }

    const summarizeAssignment = async () => {
        try {
            setIsPlanning(true)
            const source = rawImportText || importText
            if (!source || source.trim().length < 1) {
                alert("Please upload or explain the assignment details first")
                return
            }
            const res = await api.post("/ai/extract-assignment-text", { text: source })
            const data = res?.data as { clean_text?: string; suggested_title?: string }
            if (data?.clean_text) {
                setImportText(data.clean_text)
            } else {
                setImportText(source)
            }
            if (data?.suggested_title && !newAssignment.title) setNewAssignment({ ...newAssignment, title: data.suggested_title })
        } catch (e) {
            console.error("Summarization failed", e)
            alert("Failed to summarize. Please try again.")
        } finally {
            setIsPlanning(false)
        }
    }

    const generateTimeChoices = async (durationMin: number, count: number) => {
        try {
            const res = await api.get("/schedule/")
            const existing: Array<{ start_at: string; end_at: string }> = res?.data || []
            const byDay = new Map<string, Array<{ start: Date; end: Date }>>()
            for (const b of existing) {
                const s = new Date(b.start_at)
                const e = new Date(b.end_at)
                const key = s.toDateString()
                const arr = byDay.get(key) || []
                arr.push({ start: s, end: e })
                byDay.set(key, arr)
            }
            const startHour = 9
            const suggestions: Array<{ start_at: string; end_at: string }> = []
            let cursor = new Date()
            cursor.setHours(startHour, 0, 0, 0)
            const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
            while (suggestions.length < count) {
                if (!allowWeekends && isWeekend(cursor)) {
                    cursor.setDate(cursor.getDate() + 1)
                    cursor.setHours(startHour, 0, 0, 0)
                    continue
                }
                const dayKey = cursor.toDateString()
                const occupied = (byDay.get(dayKey) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
                let start = new Date(cursor)
                for (const block of occupied) {
                    if (start < block.end && start >= block.start) {
                        start = new Date(block.end.getTime() + 15 * 60 * 1000)
                    }
                }
                const end = new Date(start.getTime() + durationMin * 60 * 1000)
                const overlaps = occupied.some(o => start < o.end && end > o.start)
                if (!overlaps) suggestions.push({ start_at: start.toISOString(), end_at: end.toISOString() })
                cursor = new Date(cursor.getTime() + 90 * 60 * 1000)
                if (cursor.getHours() > 18) {
                    cursor.setDate(cursor.getDate() + 1)
                    cursor.setHours(startHour, 0, 0, 0)
                }
            }
            setSuggestedTimes(suggestions)
        } catch {
            setSuggestedTimes([])
        }
    }
    const computeTimeChoices = async (durationMin: number, count: number): Promise<Array<{ start_at: string; end_at: string }>> => {
        try {
            const res = await api.get("/schedule/")
            const existing: Array<{ start_at: string; end_at: string }> = res?.data || []
            const byDay = new Map<string, Array<{ start: Date; end: Date }>>()
            for (const b of existing) {
                const s = new Date(b.start_at)
                const e = new Date(b.end_at)
                const key = s.toDateString()
                const arr = byDay.get(key) || []
                arr.push({ start: s, end: e })
                byDay.set(key, arr)
            }
            const startHour = 9
            const suggestions: Array<{ start_at: string; end_at: string }> = []
            let cursor = new Date()
            cursor.setHours(startHour, 0, 0, 0)
            const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
            while (suggestions.length < count) {
                if (!allowWeekends && isWeekend(cursor)) {
                    cursor.setDate(cursor.getDate() + 1)
                    cursor.setHours(startHour, 0, 0, 0)
                    continue
                }
                const dayKey = cursor.toDateString()
                const occupied = (byDay.get(dayKey) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
                let start = new Date(cursor)
                for (const block of occupied) {
                    if (start < block.end && start >= block.start) {
                        start = new Date(block.end.getTime() + 15 * 60 * 1000)
                    }
                }
                const end = new Date(start.getTime() + durationMin * 60 * 1000)
                const overlaps = occupied.some(o => start < o.end && end > o.start)
                if (!overlaps) suggestions.push({ start_at: start.toISOString(), end_at: end.toISOString() })
                cursor = new Date(cursor.getTime() + 90 * 60 * 1000)
                if (cursor.getHours() > 18) {
                    cursor.setDate(cursor.getDate() + 1)
                    cursor.setHours(startHour, 0, 0, 0)
                }
            }
            return suggestions
        } catch {
            return []
        }
    }

    const getPlanTimeoutMs = () => {
        const v = parseInt(String(process.env.NEXT_PUBLIC_PLAN_TIMEOUT_MS || ''), 10)
        return Number.isFinite(v) && v > 0 ? v : 45000
    }
    const isTimeoutError = (e: unknown): boolean => {
        const err = e as { code?: string; message?: string }
        const code = String(err?.code || '').toUpperCase()
        const msg = String(err?.message || '')
        return code === 'ECONNABORTED' || /timeout/i.test(msg)
    }
    const fetchPlanWithRetry = async (assignmentId: number, tries = 2): Promise<Array<{ id?: number; title: string; estimated_minutes: number }>> => {
        const timeout = getPlanTimeoutMs()
        let lastErr: unknown = null
        for (let i = 0; i < Math.max(1, tries); i++) {
            try {
                const planRes = await api.post(`/assignments/${assignmentId}/plan`, {}, { timeout })
                return (planRes?.data as Array<{ id?: number; title: string; estimated_minutes: number }>) || []
            } catch (e) {
                lastErr = e
                if (!isTimeoutError(e)) break
                const backoff = 1500 * (i + 1)
                await new Promise(res => setTimeout(res, backoff))
                continue
            }
        }
        throw lastErr || new Error('Plan request failed')
    }

    const handleGeneratePlan = async () => {
        try {
            setIsPlanning(true)
            setPlannerAssignmentId(null)
            setPlannerAssignmentTitle(newAssignment.title || (importFileName ? importFileName.replace(/\.[^/.]+$/, "") : "Untitled Assignment"))
            const hasDetails = !!(importText && importText.trim().length > 0)
            if (!hasDetails) {
                let totalMin = 60
                try {
                    const source = (importText || rawImportText || '').trim()
                    const lines = source ? source.split(/\n+/).map(s => s.trim()).filter(Boolean) : []
                    const count = Math.max(1, Math.min(8, lines.length || 2))
                    totalMin = Math.max(30, count * 30)
                } catch {}
                const suggestions = await computeTimeChoices(totalMin, 1)
                const chosen = suggestions[0] || null
                setOneGoSuggestion(chosen ? { start_at: chosen.start_at, end_at: chosen.end_at, duration_min: totalMin } : null)
                setPlanningStep('one')
                setIsOneGoEditing(false)
            } else {
                setPlanningStep('choices')
                setEditingSubtaskIds([])
                setIsOneGoEditing(false)
                setOneGoSuggestion(null)
            }
        } catch (e) {
            console.error("Failed to generate plan", e)
            alert("Failed to generate plan. Please try again.")
        } finally {
            setIsPlanning(false)
        }
    }

    const handleConfirmSingleBlock = async (when: { start_at: string; end_at: string } | null) => {
        try {
            if (!plannerAssignmentId) return
            const title = plannerAssignmentTitle || newAssignment.title || "Study"
            const payload = {
                start_at: when ? when.start_at : singleManualStart,
                end_at: when ? when.end_at : singleManualEnd,
                type: "STUDY",
                status: "PLANNED",
                title: toTitleCase(title),
                assignment_id: plannerAssignmentId,
                source: "AI_SUGGESTED",
            }
            await api.post("/schedule/", payload)
            window.dispatchEvent(new CustomEvent('assignmentUpdated'))
            setIsAddDialogOpen(false)
            fetchAssignments(); fetchScheduleBlocks()
            setImportText("")
            setImportFileName("")
        } catch (e) {
            console.error("Failed to schedule", e)
            alert("Failed to schedule. Please try again.")
        }
    }

    const handleChooseDivideSubtasks = async () => {
        const normalizeTitle = (t: string) => {
            const lower = String(t || '').toLowerCase()
            const cleaned = lower.replace(/[^a-z0-9\s]/g, ' ')
            return cleaned.replace(/\s+/g, ' ').trim()
        }
        try {
            setIsPlanning(true)
            let raw: Array<{ id?: number; title: string; estimated_minutes: number }> = []
            if (plannerAssignmentId) {
                raw = await fetchPlanWithRetry(plannerAssignmentId, 2)
            } else {
                const source = (importText || rawImportText || '').trim()
                const lines = source ? source.split(/\n+/).map(s => s.trim()).filter(Boolean) : []
                const baseItems = (lines.length > 0 ? lines : ['Read requirements', 'Outline solution', 'Draft', 'Revise', 'Finalize']).slice(0, 8)
                raw = baseItems.map((t, i) => ({ id: i + 1, title: t || `Task ${i + 1}`, estimated_minutes: 30 }))
            }
            const grouped = raw.reduce((acc, cur, idx) => {
                const rawTitle = String(cur.title || `Task ${idx + 1}`).trim()
                const key = normalizeTitle(rawTitle)
                const title = rawTitle
                const prev = acc.get(key)
                const minutes = Math.max(15, Math.round(cur.estimated_minutes || 30))
                if (prev) {
                    prev.estimated_minutes += minutes
                } else {
                    acc.set(key, { title, estimated_minutes: minutes })
                }
                return acc
            }, new Map<string, { title: string; estimated_minutes: number }>())
            const deduped = Array.from(grouped.values()).map((s, i) => ({ id: i + 1, title: s.title, estimated_minutes: s.estimated_minutes }))
            setPlannedSubtasks(deduped)
            setPlanningStep('subtasks')
            setEditingSubtaskIds([])
            await handleAutoScheduleSubtasks()
        } catch (e) {
            if (isTimeoutError(e)) {
                const source = (importText || rawImportText || '').trim()
                const lines = source ? source.split(/\n+/).map(s => s.trim()).filter(Boolean) : []
                const baseItems = (lines.length > 0 ? lines : ['Read requirements', 'Outline solution', 'Draft', 'Revise', 'Finalize']).slice(0, 8)
                const acc = new Map<string, { title: string; estimated_minutes: number }>()
                baseItems.forEach((t, i) => {
                    const key = normalizeTitle(t || `Task ${i + 1}`)
                    const title = t || `Task ${i + 1}`
                    const prev = acc.get(key)
                    if (prev) prev.estimated_minutes += 30; else acc.set(key, { title, estimated_minutes: 30 })
                })
                const fallback = Array.from(acc.values()).map((s, i) => ({ id: i + 1, title: s.title, estimated_minutes: s.estimated_minutes }))
                setPlannedSubtasks(fallback)
                setPlanningStep('subtasks')
                setEditingSubtaskIds([])
                await handleAutoScheduleSubtasks()
                return
            }
            console.error('Failed to divide into subtasks', e)
            alert('Failed to divide into subtasks. Please try again.')
        } finally {
            setIsPlanning(false)
        }
    }

    const handleChooseOneGo = async () => {
        try {
            setIsPlanning(true)
            let totalMin = 60
            try {
                if (plannerAssignmentId) {
                    const raw = await fetchPlanWithRetry(plannerAssignmentId, 2)
                    const sum = raw.reduce((a, b) => a + Math.max(15, Math.round(b.estimated_minutes || 30)), 0)
                    totalMin = Math.max(30, sum || totalMin)
                } else {
                    const source = (importText || rawImportText || '').trim()
                    const lines = source ? source.split(/\n+/).map(s => s.trim()).filter(Boolean) : []
                    const count = Math.max(1, Math.min(8, lines.length || 2))
                    totalMin = Math.max(30, count * 30)
                }
            } catch {}
            const suggestions = await computeTimeChoices(totalMin, 1)
            const chosen = suggestions[0] || null
            setOneGoSuggestion(chosen ? { start_at: chosen.start_at, end_at: chosen.end_at, duration_min: totalMin } : null)
            setPlanningStep('one')
            setIsOneGoEditing(false)
        } catch (e) {
            console.error('Failed to plan one go', e)
            alert('Failed to plan in one go. Please try again.')
        } finally {
            setIsPlanning(false)
        }
    }

    const handleAutoScheduleSubtasks = useCallback(async () => {
        try {
            setIsPlanning(true)
            const moodRes = await api.get("/mood/", { params: { limit: 1 }, timeout: 10000 })
            type MoodItem = { additional_metrics?: { burnout_indicator?: string } }
            const latestMood: MoodItem | null = (Array.isArray(moodRes?.data) && moodRes.data.length > 0) ? (moodRes.data[0] as MoodItem) : null
            const burnout = latestMood?.additional_metrics?.burnout_indicator
            const burnoutHeavy = burnout === "noticeable" || burnout === "a_lot"
            const scheduleRes = await api.get("/schedule/")
            const existing = (scheduleRes?.data as Array<{ start_at: string; end_at: string }>) || []
            const deadline = newAssignment.due_at ? new Date(newAssignment.due_at) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
            const baseCapacityMin = Math.max(30, Math.min(8 * 60, Math.round(hoursPerDay * 60)))
            const dayCapacityMin = burnoutHeavy ? Math.round(baseCapacityMin * 0.7) : baseCapacityMin
            const byDay = new Map<string, Array<{ start: Date; end: Date }>>()
            for (const b of existing) {
                const s = new Date(b.start_at)
                const e = new Date(b.end_at)
                const key = s.toDateString()
                const arr = byDay.get(key) || []
                arr.push({ start: s, end: e })
                byDay.set(key, arr)
            }
            const startHour = 9
            const breakMin = burnoutHeavy ? 25 : 15
            const now = new Date()
            let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 0, 0)
            const withinDeadline = (d: Date) => d <= deadline
            const isWeekend = (d: Date) => { const day = d.getDay(); return day === 0 || day === 6 }
            let dayUsedMin = 0
            const updated = plannedSubtasks.map(p => ({ ...p }))
            for (let i = 0; i < updated.length; i++) {
                const s = updated[i]
                const requiredMin = Math.max(15, Math.round(s.estimated_minutes || 30))
                let assigned = false
                while (!assigned) {
                    if (!withinDeadline(cursor)) break
                    if (!allowWeekends && isWeekend(cursor)) { const next = new Date(cursor); next.setDate(cursor.getDate() + 1); next.setHours(startHour, 0, 0, 0); cursor = next; dayUsedMin = 0; continue }
                    const availableToday = dayCapacityMin - dayUsedMin
                    if (availableToday < requiredMin) { const next = new Date(cursor); next.setDate(cursor.getDate() + 1); next.setHours(startHour, 0, 0, 0); cursor = next; dayUsedMin = 0; continue }
                    const dayKey = cursor.toDateString()
                    const occupied = (byDay.get(dayKey) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
                    let start = new Date(cursor)
                    for (const block of occupied) { if (start < block.end && (start >= block.start)) { start = new Date(block.end.getTime() + breakMin * 60 * 1000) } }
                    const end = new Date(start.getTime() + requiredMin * 60 * 1000)
                    const overlaps = occupied.some(o => start < o.end && end > o.start)
                    if (overlaps) { cursor = new Date(occupied[occupied.length - 1].end.getTime() + breakMin * 60 * 1000); continue }
                    occupied.push({ start, end })
                    byDay.set(dayKey, occupied)
                    updated[i] = { ...s, start_at: start.toISOString(), end_at: end.toISOString() }
                    dayUsedMin += requiredMin
                    cursor = new Date(end.getTime() + breakMin * 60 * 1000)
                    assigned = true
                }
            }
            setPlannedSubtasks(updated)
        } catch (e) {
            console.error("Failed to auto-schedule subtasks", e)
            alert("Failed to auto-schedule. Please try again.")
        } finally {
            setIsPlanning(false)
        }
    }, [plannerAssignmentId, newAssignment.due_at, hoursPerDay, allowWeekends, plannedSubtasks])

    useEffect(() => {
        const hasSummary = !!(importText && importText.trim().length > 0)
        const needsSuggestion = plannedSubtasks.length > 0 && plannedSubtasks.every(s => !s.start_at || !s.end_at)
        if (plannerAssignmentId && hasSummary && divideMode === "subtasks" && scheduleMode === "ai" && needsSuggestion) {
            handleAutoScheduleSubtasks()
        }
    }, [plannerAssignmentId, importText, divideMode, scheduleMode, plannedSubtasks, handleAutoScheduleSubtasks])

    const handleApplySubtasksToCalendar = async () => {
        try {
            if (!plannerAssignmentId) return
            for (const s of plannedSubtasks) {
                if (!s.start_at || !s.end_at) continue
                const payload = {
                    start_at: s.start_at,
                    end_at: s.end_at,
                    type: "STUDY",
                    status: "PLANNED",
                    title: toTitleCase(`${plannerAssignmentTitle || newAssignment.title} - ${s.title}`),
                    assignment_id: plannerAssignmentId,
                    subtask_id: s.id,
                    source: "AI_SUGGESTED",
                }
                await api.post("/schedule/", payload)
            }
            window.dispatchEvent(new CustomEvent('assignmentUpdated'))
            setIsAddDialogOpen(false)
            fetchAssignments(); fetchScheduleBlocks()
            setImportText("")
            setImportFileName("")
            setPlannedSubtasks([])
        } catch (e) {
            console.error("Failed to add subtasks", e)
            alert("Failed to add planned tasks. Please try again.")
        }
    }
    


    const fetchAssignments = async () => {
        try {
            const response = await api.get("/assignments/")
            setAssignments(response.data)
        } catch (error) {
            console.error("Failed to fetch assignments", error)
        }
    }

    const fetchScheduleBlocks = async () => {
        try {
            const response = await api.get("/schedule/")
            setScheduleBlocks(response.data || [])
        } catch (error) {
            console.error("Failed to fetch schedule", error)
        }
    }

    const fetchCourses = async () => {
        try {
            const response = await api.get("/courses/")
            setCourses(response.data || [])
        } catch (error) {
            console.error("Failed to fetch courses", error)
        }
    }

    useEffect(() => {
        if (!token) {
            router.replace('/login')
            return
        }
        const id = setTimeout(() => {
            fetchAssignments()
            fetchScheduleBlocks()
            fetchCourses()
        }, 0)

        const refresh = () => { fetchAssignments(); fetchScheduleBlocks() }
        window.addEventListener('assignmentAdded', refresh as EventListener)
        window.addEventListener('assignmentUpdated', refresh as EventListener)

        return () => {
            clearTimeout(id)
            window.removeEventListener('assignmentAdded', refresh as EventListener)
            window.removeEventListener('assignmentUpdated', refresh as EventListener)
        }
    }, [token, router])

    const resetAddDialogState = () => {
        setNewAssignment({
            title: "",
            course_id: "",
            due_at: "",
            difficulty: "MEDIUM",
            status: "NOT_STARTED",
            source_type: "manual",
            user_confidence: 3,
            importance_level: "medium"
        })
        setNewAssignmentCourseText("")
        setHoursPerDay(2)
        setHoursPerDayInput("2")
        setHoursPerDayError(null)
        setAllowWeekends(true)
        setImportText("")
        setRawImportText("")
        setImportFileName("")
        setPlannerAssignmentId(null)
        setPlannerAssignmentTitle("")
        setPlanningStep('none')
        setPlannedSubtasks([])
        setSuggestedTimes([])
        setEditingSubtaskIds([])
        setIsOneGoEditing(false)
        setOneGoSuggestion(null)
        setDivideMode("subtasks")
        setScheduleMode("ai")
        setSingleManualStart("")
        setSingleManualEnd("")
        setIsPlanning(false)
    }

    const handleAddDialogOpenChange = (open: boolean) => {
        resetAddDialogState()
        setIsAddDialogOpen(open)
    }

    const handleCreateAssignment = async () => {
        try {
            const resolvedCourseId = newAssignment.course_id ? parseInt(newAssignment.course_id) : await resolveCourseId(newAssignmentCourseText)
            await api.post("/assignments/", {
                title: toTitleCase(newAssignment.title),
                course_id: resolvedCourseId ?? null,
                due_at: (() => {
                    if (!newAssignment.due_at) return undefined
                    const d = new Date(newAssignment.due_at)
                    const tz = d.getTimezoneOffset()
                    const sign = tz <= 0 ? "+" : "-"
                    const abs = Math.abs(tz)
                    const offH = String(Math.floor(abs / 60)).padStart(2, "0")
                    const offM = String(abs % 60).padStart(2, "0")
                    const pad = (n: number) => String(n).padStart(2, "0")
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offH}:${offM}`
                })(),
                // Let backend defaults handle difficulty unless explicitly set
                status: (newAssignment.status || "NOT_STARTED").toUpperCase(),
                source_type: (newAssignment.source_type || "manual").toLowerCase(),
                user_confidence: newAssignment.user_confidence ?? 3,
                importance_level: (newAssignment.importance_level || "medium").toLowerCase(),
            })
            setIsAddDialogOpen(false)
            fetchAssignments(); fetchScheduleBlocks()
            resetAddDialogState()
        } catch (error) {
            console.error("Failed to create assignment", error)
        }
    }

    

    

    

    

    

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
                <div className="flex items-center space-x-2">
                    <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Assignment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[1000px] max-h-[100vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add Assignment</DialogTitle>
                                <DialogDescription>
                                    Create a new assignment to track your progress.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className="block">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g., Final Paper"
                                        className="w-full"
                                        value={newAssignment.title}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="block">Course</Label>
                                    <Input
                                        placeholder="Type course"
                                        className="w-full"
                                        value={newAssignmentCourseText}
                                        onChange={(e) => { setNewAssignmentCourseText(e.target.value); setNewAssignment({ ...newAssignment, course_id: "" }) }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dueDate" className="block">Due Date</Label>
                                    <DateTimePicker
                                        id="dueDate"
                                        className="w-full"
                                        value={newAssignment.due_at}
                                        onChange={(v) => setNewAssignment({ ...newAssignment, due_at: v })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="importance" className="block">Importance</Label>
                                    <Select
                                        value={newAssignment.importance_level}
                                        onValueChange={(value) => setNewAssignment({ ...newAssignment, importance_level: value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select importance" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confidence" className="block">Confidence (1-5)</Label>
                                    <Input
                                        id="confidence"
                                        type="number"
                                        min="1"
                                        max="5"
                                        className="w-full"
                                        value={Number.isFinite(newAssignment.user_confidence) ? newAssignment.user_confidence : 1}
                                        onChange={(e) => {
                                            const parsed = parseInt(e.target.value, 10)
                                            const next = Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 1
                                            setNewAssignment({ ...newAssignment, user_confidence: next })
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="block">Hours/Day</Label>
                                    <div className="space-y-1">
                                        <Input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            className="w-full"
                                            value={hoursPerDayInput}
                                            onChange={(e) => {
                                                const raw = e.target.value
                                                setHoursPerDayInput(raw)
                                                const v = parseFloat(raw)
                                                if (Number.isFinite(v) && v > 18) {
                                                    setHoursPerDayError("please enter the right amount of hours per day you can work")
                                                } else {
                                                    setHoursPerDayError(null)
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const v = parseFloat(e.target.value)
                                                const next = Number.isFinite(v) ? Math.max(0.5, Math.min(18, v)) : 2
                                                if (Number.isFinite(v) && v > 18) {
                                                    setHoursPerDayError("please enter the right amount of hours per day you can work")
                                                } else {
                                                    setHoursPerDayError(null)
                                                }
                                                setHoursPerDay(next)
                                                setHoursPerDayInput(String(next))
                                            }}
                                        />
                                        {hoursPerDayError && (
                                            <div className="text-red-500 text-xs">{hoursPerDayError}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="block">Allow Weekends</Label>
                                    <div className="w-full"><Switch checked={allowWeekends} onCheckedChange={setAllowWeekends} /></div>
                                </div>
                            </div>
                        <div className="py-2">
                            <div className="w-full space-y-3">
                                <div className="w-full">
                                    <Label className="mb-2 block">Import Document</Label>
                                    <Input type="file" accept=".txt,.md,.docx,.pdf" onChange={(e) => handleImportFile(e.target.files?.[0] || null)} />
                                </div>
                                <div className="w-full">
                                    <Label className="mb-2 block">Summarized Assignment</Label>
                                    <textarea className="w-full h-64 rounded-md border p-3" placeholder="If you don't upload a document, briefly explain the assignment here before summarizing." value={importText} onChange={(e) => setImportText(e.target.value)} />
                                    <div className="text-xs text-muted-foreground mt-1">Summarized content appears here after pressing &quot;Summarize Assignment&quot;</div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    {(rawImportText.trim().length > 0 || (importText.trim().length > 0 && rawImportText.trim().length === 0)) && (
                                        <Button variant="secondary" onClick={summarizeAssignment} disabled={isPlanning}>{isPlanning ? "Working..." : "Summarize Assignment"}</Button>
                                    )}
                                    <Button onClick={handleGeneratePlan} disabled={isPlanning}>{isPlanning ? "Generating..." : "Generate Plan"}</Button>
                                </div>
                            </div>
                        </div>

                        {planningStep !== 'none' && (
                            <div className="space-y-4 mt-2">
                                {planningStep === 'choices' && (
                                    <div className="flex justify-center gap-3">
                                        <Button onClick={handleChooseDivideSubtasks} disabled={isPlanning}>Divide into subtasks</Button>
                                        <Button onClick={handleChooseOneGo} disabled={isPlanning}>One go</Button>
                                    </div>
                                )}

                                {planningStep === 'one' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-12 gap-2 items-center text-xs font-medium text-muted-foreground">
                                                <div className="col-span-4">Assignment</div>
                                                <div className="col-span-3">Estimated Duration (min)</div>
                                                <div className="col-span-5">Suggested time and date</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-4">
                                                    <Input value={plannerAssignmentTitle || newAssignment.title || 'Assignment'} disabled />
                                                </div>
                                                <div className="col-span-3">
                                                    <Input type="number" value={oneGoSuggestion?.duration_min || 60} disabled />
                                                </div>
                                                <div className="col-span-5">
                                                    {!isOneGoEditing ? (
                                                        <button className="text-left text-sm w-full" onClick={() => setIsOneGoEditing(true)}>
                                                            {oneGoSuggestion ? `${new Date(oneGoSuggestion.start_at).toLocaleString()} → ${new Date(oneGoSuggestion.end_at).toLocaleString()}` : 'No suggestion'}
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <DateTimePicker value={oneGoSuggestion?.start_at || ''} onChange={(v) => setOneGoSuggestion(prev => prev ? { ...prev, start_at: v } : prev)} />
                                                                <DateTimePicker value={oneGoSuggestion?.end_at || ''} onChange={(v) => setOneGoSuggestion(prev => prev ? { ...prev, end_at: v } : prev)} />
                                                            </div>
                                                            <div className="flex justify-end">
                                                                <Button size="sm" variant="outline" onClick={() => setIsOneGoEditing(false)}>Done</Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {planningStep === 'subtasks' && plannedSubtasks.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-12 gap-2 items-center text-xs font-medium text-muted-foreground">
                                                <div className="col-span-4">Subtask</div>
                                                <div className="col-span-2">Duration (min)</div>
                                                <div className="col-span-6">Time</div>
                                            </div>
                                            {plannedSubtasks.map((s, idx) => (
                                                <div key={`${s.id}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-4">
                                                        <Input value={s.title} disabled />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <Input type="number" min="15" step="5" value={s.estimated_minutes} disabled />
                                                    </div>
                                                    <div className="col-span-6">
                                                        {!editingSubtaskIds.includes(s.id) ? (
                                                            <button className="text-left text-sm w-full" onClick={() => {
                                                                setEditingSubtaskIds(prev => prev.includes(s.id) ? prev : [...prev, s.id])
                                                            }}>
                                                                {s.start_at && s.end_at ? `${new Date(s.start_at).toLocaleString()} → ${new Date(s.end_at).toLocaleString()}` : 'No suggestion'}
                                                            </button>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <DateTimePicker value={s.start_at || ''} onChange={(v) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, start_at: v } : p))} />
                                                                    <DateTimePicker value={s.end_at || ''} onChange={(v) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, end_at: v } : p))} />
                                                                </div>
                                                                <div className="flex justify-end">
                                                                    <Button size="sm" variant="outline" onClick={() => setEditingSubtaskIds(prev => prev.filter(id => id !== s.id))}>Done</Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                            <DialogFooter>
                                <Button variant="outline" onClick={handleCreateAssignment} disabled={isPlanning}>Save Assignment</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>All Tasks</CardTitle>
                                <CardDescription>Tasks scheduled in your calendar.</CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search tasks..." className="pl-8 w-[300px]" value={allTasksQuery} onChange={(e) => setAllTasksQuery(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const filtered = scheduleBlocks.filter(b => {
                                const q = allTasksQuery.trim().toLowerCase()
                                if (!q) return true
                                return String(b.title || '').toLowerCase().includes(q)
                            }).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                            return (
                                <ScrollArea className="h-[540px] w-full p-2">
                                    {filtered.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No tasks scheduled.</div>
                                    ) : (
                                        filtered.map((t) => (
                                            <div key={`task-${t.id}`} className="flex flex-col items-start space-y-1 p-2 border rounded-md mb-2">
                                                <div className="flex w-full items-center justify-between">
                                                    <span className="font-medium text-sm">{toTitleCase(t.title)}</span>
                                                    {t.assignment_id ? (
                                                        <Badge variant="secondary">{t.type || 'STUDY'}</Badge>
                                                    ) : null}
                                                </div>
                                                <div className="text-xs text-muted-foreground w-full flex justify-between">
                                                    <span>Start: {new Date(t.start_at).toLocaleString()}</span>
                                                    <span>End: {new Date(t.end_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </ScrollArea>
                            )
                        })()}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>All Assignments</CardTitle>
                                <CardDescription>Review and manage assignments.</CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search assignments..." className="pl-8 w-[280px]" value={allAssignmentsQuery} onChange={(e) => setAllAssignmentsQuery(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Input placeholder="Filter by course" className="w-[240px]" value={assignmentsCourseFilter} onChange={(e) => setAssignmentsCourseFilter(e.target.value)} />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <Download className="mr-2 h-4 w-4" /> Download
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => downloadAssignments("json", getAllAssignmentsList())}>JSON</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => downloadAssignments("csv", getAllAssignmentsList())}>CSV</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const filtered = getAllAssignmentsList()
                            return (
                                <ScrollArea className="h-[540px] w-full p-2">
                                    {filtered.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground">No assignments found.</div>
                                    ) : (
                                        filtered.map((assignment) => (
                                            <div key={`assign-${assignment.id}`} className="flex flex-col items-start space-y-1 p-2 border rounded-md mb-2">
                                                <div className="flex w-full items-center justify-between">
                                                    <span className="font-medium text-base">{toTitleCase(assignment.title)}</span>
                                                    <Badge variant={assignment.importance_level === 'high' || assignment.importance_level === 'critical' ? 'destructive' : assignment.importance_level === 'medium' ? 'default' : 'secondary'}>
                                                        {assignment.importance_level}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground w-full flex justify-between">
                                                    <span>Course: {courseLabel(assignment.course_id)}</span>
                                                    <span>Due: {new Date(assignment.due_at).toLocaleString()}</span>
                                                </div>
                                                <div className="text-xs">Confidence: {assignment.user_confidence ?? 'N/A'}</div>
                                            </div>
                                        ))
                                    )}
                                </ScrollArea>
                            )
                        })()}
                    </CardContent>
                </Card>
            </div>

            
        </div>
    )
}
