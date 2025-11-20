"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { Plus, Search, Filter, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import api from "@/lib/api"

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
    const [importText, setImportText] = useState("")
    const [importFileName, setImportFileName] = useState("")
    const [plannerTitle, setPlannerTitle] = useState("")
    const [plannerDeadline, setPlannerDeadline] = useState("")
    const [plannerCourseText, setPlannerCourseText] = useState<string>("")
    const [hoursPerDay, setHoursPerDay] = useState<number>(2)
    const [allowWeekends, setAllowWeekends] = useState<boolean>(true)
    const [plannedSubtasks, setPlannedSubtasks] = useState<Array<{ id: number; title: string; estimated_minutes: number; order_index?: number; start_at?: string; end_at?: string }>>([])
    const [isPlanning, setIsPlanning] = useState(false)
    const [isExtracting, setIsExtracting] = useState(false)
    const [suggestionOpen, setSuggestionOpen] = useState(false)
    const [suggestedHoursPerDay, setSuggestedHoursPerDay] = useState<number | null>(null)
    const [workSummary, setWorkSummary] = useState<{ totalHours: number; daysAvailable: number } | null>(null)
    const [plannerAssignmentId, setPlannerAssignmentId] = useState<number | null>(null)
    const [plannerAssignmentTitle, setPlannerAssignmentTitle] = useState<string>("")
    const [allTasksQuery, setAllTasksQuery] = useState<string>("")
    const [allAssignmentsQuery, setAllAssignmentsQuery] = useState<string>("")
    const [assignmentsSortBy, setAssignmentsSortBy] = useState<"due" | "importance">("due")
    const [assignmentsCourseFilter, setAssignmentsCourseFilter] = useState<string>("")
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
    

    const fetchAssignments = async () => {
        try {
            const response = await api.get("/assignments/")
            setAssignments(response.data)
        } catch (error) {
            console.error("Failed to fetch assignments", error)
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
            fetchCourses()
        }, 0)

        const refresh = () => fetchAssignments()
        window.addEventListener('assignmentAdded', refresh as EventListener)
        window.addEventListener('assignmentUpdated', refresh as EventListener)

        return () => {
            clearTimeout(id)
            window.removeEventListener('assignmentAdded', refresh as EventListener)
            window.removeEventListener('assignmentUpdated', refresh as EventListener)
        }
    }, [token, router])

    const handleCreateAssignment = async () => {
        try {
            await api.post("/assignments/", {
                title: newAssignment.title,
                course_id: newAssignment.course_id ? parseInt(newAssignment.course_id) : null,
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
            fetchAssignments()
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
        } catch (error) {
            console.error("Failed to create assignment", error)
        }
    }

    const handleGeneratePlan = async (assignmentId: number) => {
        try {
            await api.post(`/assignments/${assignmentId}/plan`)
            alert("AI plan generated successfully!")
            fetchAssignments()
        } catch (error) {
            console.error("Failed to generate plan", error)
            alert("Failed to generate plan. Please try again.")
        }
    }

    const handleImportFile = async (file: File | null) => {
        try {
            if (!file) return
            setImportFileName(file.name)
            const name = file.name.toLowerCase()
            const type = (file.type || "").toLowerCase()
            const setTitleIfEmpty = () => {
                if (!plannerTitle) setPlannerTitle(file.name.replace(/\.[^/.]+$/, ""))
            }

            // .txt / .md
            if (type.startsWith("text/") || name.endsWith(".md") || name.endsWith(".txt")) {
                const text = await file.text()
                setImportText(text)
                setTitleIfEmpty()
                return
            }

            // .docx via mammoth
            if (name.endsWith(".docx") || type.includes("openxmlformats-officedocument.wordprocessingml.document")) {
                try {
                    const { default: mammoth } = await import("mammoth")
                    const buffer = await file.arrayBuffer()
                    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
                    const text = String(result?.value || "").replace(/\s+/g, " ").trim()
                    setImportText(text)
                    setTitleIfEmpty()
                    return
                } catch (e) {
                    const text = await file.text().catch(() => "")
                    setImportText(text || "")
                    setTitleIfEmpty()
                    return
                }
            }

            // .pdf via pdfjs-dist
            if (name.endsWith(".pdf") || type.includes("pdf")) {
                try {
                    const pdfjsLib = await import("pdfjs-dist")
                    // @ts-ignore set worker to empty; Next.js build includes default worker
                    pdfjsLib.GlobalWorkerOptions.workerSrc = undefined
                    const buffer = await file.arrayBuffer()
                    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
                    let full = ""
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i)
                        const content = await page.getTextContent()
                        const strings = (content?.items || []).map((item: any) => {
                            const s = (item?.str ?? "") as string
                            return s
                        })
                        full += strings.join(" ") + "\n"
                    }
                    const text = full.replace(/\s+/g, " ").trim()
                    setImportText(text)
                    setTitleIfEmpty()
                    return
                } catch (e) {
                    const text = await file.text().catch(() => "")
                    setImportText(text || "")
                    setTitleIfEmpty()
                    return
                }
            }

            // Fallback for unknown types
            const fallback = await file.text().catch(() => "")
            setImportText(fallback || "")
            setTitleIfEmpty()
        } catch {}
    }

    const isoWithTZ = (d: Date) => {
        const tz = d.getTimezoneOffset()
        const sign = tz <= 0 ? "+" : "-"
        const abs = Math.abs(tz)
        const offH = String(Math.floor(abs / 60)).padStart(2, "0")
        const offM = String(abs % 60).padStart(2, "0")
        const pad = (n: number) => String(n).padStart(2, "0")
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offH}:${offM}`
    }

    const generatePlanner = async () => {
        try {
            setIsPlanning(true)
            const title = plannerTitle || (importFileName ? importFileName.replace(/\.[^/.]+$/, "") : newAssignment.title || "Untitled Assignment")
            const dueIso = (() => {
                if (!plannerDeadline) return undefined
                const d = new Date(plannerDeadline)
                return isoWithTZ(d)
            })()
            const createRes = await api.post("/assignments/", {
                title,
                description: importText || "",
                due_at: dueIso,
                status: "NOT_STARTED",
                importance_level: "medium",
                course_id: await resolveCourseId(plannerCourseText),
            }, { timeout: 20000 })
            const created = createRes?.data as { id: number }
            setPlannerAssignmentId(created?.id ?? null)
            setPlannerAssignmentTitle(title)
            const planRes = await api.post(`/assignments/${created.id}/plan`, undefined, { timeout: 60000 })
            const subtasks = (planRes?.data as Array<{ id: number; title: string; estimated_minutes: number; order_index?: number }>) || []
            const moodRes = await api.get("/mood/", { params: { limit: 1 }, timeout: 10000 })
            const latestMood = (Array.isArray(moodRes?.data) && moodRes.data.length > 0) ? moodRes.data[0] as any : null
            const burnout = latestMood?.additional_metrics?.burnout_indicator as string | undefined
            const burnoutHeavy = burnout === "noticeable" || burnout === "a_lot"

            const scheduleRes = await api.get("/schedule/", { timeout: 20000 })
            const existing = (scheduleRes?.data as Array<{ start_at: string; end_at: string }>) || []
            const deadline = plannerDeadline ? new Date(plannerDeadline) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
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
            const isWeekend = (d: Date) => {
                const day = d.getDay()
                return day === 0 || day === 6
            }

            let dayUsedMin = 0
            const toLocalInput = (d: Date) => {
                const pad = (n: number) => String(n).padStart(2, "0")
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
            }
            const advanceToNextDay = () => {
                const next = new Date(cursor)
                next.setDate(cursor.getDate() + 1)
                next.setHours(startHour, 0, 0, 0)
                cursor = next
                dayUsedMin = 0
            }

            const scheduled: Array<{ id: number; title: string; estimated_minutes: number; order_index?: number; start_at?: string; end_at?: string }> = []
            for (const s of subtasks) {
                let remaining = Math.max(15, Math.round(s.estimated_minutes || 30))
                while (remaining > 0) {
                    if (!withinDeadline(cursor)) break
                    if (!allowWeekends && isWeekend(cursor)) {
                        advanceToNextDay()
                        continue
                    }
                    const availableToday = dayCapacityMin - dayUsedMin
                    if (availableToday <= 0) {
                        advanceToNextDay()
                        continue
                    }
                    const baseMin = burnoutHeavy ? 20 : 30
                    const cap = burnoutHeavy ? Math.min(60, remaining) : remaining
                    const slotMin = Math.min(cap, Math.max(baseMin, availableToday))

                    const dayKey = cursor.toDateString()
                    const occupied = (byDay.get(dayKey) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
                    let start = new Date(cursor)
                    for (const block of occupied) {
                        if (start < block.end && (start >= block.start)) {
                            start = new Date(block.end.getTime() + breakMin * 60 * 1000)
                        }
                    }
                    const end = new Date(start.getTime() + slotMin * 60 * 1000)
                    occupied.push({ start, end })
                    byDay.set(dayKey, occupied)

                    scheduled.push({ id: s.id, title: s.title, estimated_minutes: s.estimated_minutes, order_index: s.order_index, start_at: toLocalInput(start), end_at: toLocalInput(end) })

                    dayUsedMin += slotMin
                    remaining -= slotMin
                    cursor = new Date(end.getTime() + breakMin * 60 * 1000)
                }
            }

            setPlannedSubtasks(scheduled)

            const totalMin = Math.max(0, scheduled.reduce((acc, s) => acc + Math.max(15, Math.round(s.estimated_minutes || 30)), 0))
            const countDays = (start: Date, finish: Date, includeWeekends: boolean) => {
                let d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
                const last = new Date(finish.getFullYear(), finish.getMonth(), finish.getDate())
                let count = 0
                while (d <= last) {
                    const wd = d.getDay()
                    if (includeWeekends || (wd !== 0 && wd !== 6)) count++
                    d.setDate(d.getDate() + 1)
                }
                return Math.max(1, count)
            }
            const daysAvail = countDays(now, deadline, allowWeekends)
            const capacityMin = Math.max(30, Math.round(hoursPerDay * 60)) * daysAvail
            if (capacityMin < totalMin) {
                const neededPerDayMin = Math.ceil(totalMin / daysAvail)
                const suggested = Math.max(0.5, Math.round(neededPerDayMin / 60 * 2) / 2)
                setSuggestedHoursPerDay(suggested)
                setWorkSummary({ totalHours: Math.round(totalMin / 60 * 10) / 10, daysAvailable: daysAvail })
                setSuggestionOpen(true)
            }
        } catch (e) {
            console.error("Failed to generate planner", e)
            alert("Failed to generate planner. Please check inputs and try again.")
        } finally {
            setIsPlanning(false)
        }
    }

    const extractUsingAI = async () => {
        try {
            setIsExtracting(true)
            if (!importText || importText.trim().length < 10) {
                alert("Please upload or paste assignment details first")
                return
            }
            const res = await api.post("/ai/extract-assignment-text", { text: importText })
            const data = res?.data as { clean_text?: string; suggested_title?: string }
            if (data?.clean_text) setImportText(data.clean_text)
            if (data?.suggested_title && !plannerTitle) setPlannerTitle(data.suggested_title)
        } catch (e) {
            console.error("AI extraction failed", e)
            alert("AI extraction failed. Please try again or edit manually.")
        } finally {
            setIsExtracting(false)
        }
    }

    const addPlanToCalendar = async () => {
        try {
            if (!plannedSubtasks.length) return
            const moodRes = await api.get("/mood/", { params: { limit: 1 }, timeout: 10000 })
            const latestMood = (Array.isArray(moodRes?.data) && moodRes.data.length > 0) ? moodRes.data[0] as any : null
            const burnout = latestMood?.additional_metrics?.burnout_indicator as string | undefined
            const burnoutHeavy = burnout === "noticeable" || burnout === "a_lot"

            const scheduleRes = await api.get("/schedule/")
            const existing = (scheduleRes?.data as Array<{ start_at: string; end_at: string }>) || []
            const deadline = plannerDeadline ? new Date(plannerDeadline) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
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
            const isWeekend = (d: Date) => {
                const day = d.getDay()
                return day === 0 || day === 6
            }

            let dayUsedMin = 0
            const createdBlocks: Array<{ id?: number }> = []

            const advanceToNextDay = () => {
                const next = new Date(cursor)
                next.setDate(cursor.getDate() + 1)
                next.setHours(startHour, 0, 0, 0)
                cursor = next
                dayUsedMin = 0
            }

            for (const s of plannedSubtasks) {
                if (s.start_at && s.end_at) {
                    const start = new Date(s.start_at)
                    const end = new Date(s.end_at)
                    const payload = {
                        start_at: start.toISOString(),
                        end_at: end.toISOString(),
                        type: "STUDY",
                        status: "PLANNED",
                        title: plannerAssignmentTitle ? `${plannerAssignmentTitle} - ${s.title}` : s.title,
                        assignment_id: plannerAssignmentId ?? undefined,
                        subtask_id: s.id,
                        source: "AI_SUGGESTED",
                    }
                    try {
                        const created = await api.post("/schedule/", payload)
                        createdBlocks.push(created?.data || {})
                    } catch {}
                    continue
                }
                let remaining = Math.max(15, Math.round(s.estimated_minutes || 30))
                while (remaining > 0) {
                    if (!withinDeadline(cursor)) break
                    if (!allowWeekends && isWeekend(cursor)) {
                        advanceToNextDay()
                        continue
                    }
                    // Ensure we don't exceed daily capacity
                    const availableToday = dayCapacityMin - dayUsedMin
                    if (availableToday <= 0) {
                        advanceToNextDay()
                        continue
                    }
                    const baseMin = burnoutHeavy ? 20 : 30
                    const cap = burnoutHeavy ? Math.min(60, remaining) : remaining
                    const slotMin = Math.min(cap, Math.max(baseMin, availableToday))

                    const dayKey = cursor.toDateString()
                    const occupied = (byDay.get(dayKey) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
                    // Find next non-overlapping start time
                    let start = new Date(cursor)
                    for (const block of occupied) {
                        if (start < block.end && (start >= block.start)) {
                            start = new Date(block.end.getTime() + breakMin * 60 * 1000)
                        }
                    }
                    const end = new Date(start.getTime() + slotMin * 60 * 1000)
                    // Record occupancy for rest of planning loop
                    occupied.push({ start, end })
                    byDay.set(dayKey, occupied)

                    const payload = {
                        start_at: end < deadline ? start.toISOString() : deadline.toISOString(),
                        end_at: end < deadline ? end.toISOString() : deadline.toISOString(),
                        type: "STUDY",
                        status: "PLANNED",
                        title: plannerAssignmentTitle ? `${plannerAssignmentTitle} - ${s.title}` : s.title,
                        assignment_id: plannerAssignmentId ?? undefined,
                        subtask_id: s.id,
                        source: "AI_SUGGESTED",
                    }
                    try {
                        const created = await api.post("/schedule/", payload)
                        createdBlocks.push(created?.data || {})
                    } catch {}

                    dayUsedMin += slotMin
                    remaining -= slotMin
                    // Move cursor forward for next block
                    cursor = new Date(end.getTime() + breakMin * 60 * 1000)
                }
            }

            window.dispatchEvent(new CustomEvent('assignmentUpdated'))
            alert(`Added ${createdBlocks.length} study blocks to your calendar`)
        } catch (e) {
            console.error("Failed to add plan to calendar", e)
            alert("Failed to add plan to calendar. Please try again.")
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
                <div className="flex items-center space-x-2">
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Assignment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add Assignment</DialogTitle>
                                <DialogDescription>
                                    Create a new assignment to track your progress.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                placeholder="e.g., Final Paper"
                                className="col-span-3"
                                value={newAssignment.title}
                                onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Course</Label>
                            <Input
                                placeholder="Type course"
                                className="col-span-3"
                                value={(newAssignment as any).course_text || ""}
                                onChange={(e) => setNewAssignment({ ...newAssignment, course_id: "", ...( { course_text: e.target.value } as any) })}
                            />
                        </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="dueDate" className="text-right">
                                        Due Date
                                    </Label>
                                    <Input
                                        id="dueDate"
                                        type="datetime-local"
                                        className="col-span-3"
                                        value={newAssignment.due_at}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, due_at: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="importance" className="text-right">
                                        Importance
                                    </Label>
                                    <Select
                                        value={newAssignment.importance_level}
                                        onValueChange={(value) => setNewAssignment({ ...newAssignment, importance_level: value })}
                                    >
                                        <SelectTrigger className="col-span-3">
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
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="confidence" className="text-right">
                                        Confidence (1-5)
                                    </Label>
                        <Input
                            id="confidence"
                            type="number"
                            min="1"
                            max="5"
                            className="col-span-3"
                            value={Number.isFinite(newAssignment.user_confidence) ? newAssignment.user_confidence : 1}
                            onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10)
                                const next = Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 1
                                setNewAssignment({ ...newAssignment, user_confidence: next })
                            }}
                        />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" onClick={handleCreateAssignment}>Save Assignment</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>All Tasks</CardTitle>
                            <CardDescription>
                                Manage your coursework, deadlines, and progress.
                            </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search tasks..." className="pl-8 w-[300px]" value={allTasksQuery} onChange={(e) => setAllTasksQuery(e.target.value)} />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const filtered = assignments.filter(a => !a.title?.toLowerCase().includes('break'))
                            .filter(a => {
                                if (!allTasksQuery.trim()) return true
                                const q = allTasksQuery.toLowerCase()
                                return (a.title?.toLowerCase().includes(q) || a.importance_level?.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
                            })
                        const sorted = filtered.slice().sort((a, b) => {
                            const aCompleted = String(a.status || '').toUpperCase() === 'COMPLETED'
                            const bCompleted = String(b.status || '').toUpperCase() === 'COMPLETED'
                            if (aCompleted !== bCompleted) return aCompleted ? 1 : -1
                            const ad = a.created_at ? new Date(a.created_at).getTime() : new Date(a.due_at).getTime()
                            const bd = b.created_at ? new Date(b.created_at).getTime() : new Date(b.due_at).getTime()
                            return bd - ad
                        })

                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full">All Tasks ({sorted.length})</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="bottom" align="start" sideOffset={6} avoidCollisions={false} className="w-[860px] bg-background border shadow-xl">
                                    <ScrollArea className="h-[540px] w-full p-2">
                                        {sorted.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">No assignments found.</div>
                                        ) : (
                                            sorted.map((assignment, idx) => (
                                                <DropdownMenuItem key={`${assignment.id}-${idx}`} className="flex flex-col items-start space-y-1">
                                                    <div className="flex w-full items-center justify-between">
                                                        <span className="font-medium">{assignment.title}</span>
                                                        <Badge variant={
                                                            assignment.importance_level === 'high' || assignment.importance_level === 'critical' ? 'destructive' :
                                                                assignment.importance_level === 'medium' ? 'default' : 'secondary'
                                                        }>
                                                            {assignment.importance_level}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground w-full flex justify-between">
                                                        <span>Course: {courseLabel(assignment.course_id)}</span>
                                                        <span>Due: {new Date(assignment.due_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-xs">Status: {assignment.status}</div>
                                                    <div className="flex w-full justify-end space-x-2 pt-1">
                                                        <Button variant="ghost" size="sm">Edit</Button>
                                                        <Button variant="outline" size="sm" onClick={() => handleGeneratePlan(assignment.id)}>Generate Plan</Button>
                                                    </div>
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </ScrollArea>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    })()}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>All Assignments</CardTitle>
                            <CardDescription>Review full assignment details and your planner inputs.</CardDescription>
                        </div>
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search assignments..." className="pl-8 w-[280px]" value={allAssignmentsQuery} onChange={(e) => setAllAssignmentsQuery(e.target.value)} />
                        </div>
                        <div className="relative">
                            <Input placeholder="Filter by course" className="w-[240px]" value={assignmentsCourseFilter} onChange={(e) => setAssignmentsCourseFilter(e.target.value)} />
                        </div>
                        <div className="flex rounded-md overflow-hidden border">
                            <Button variant={assignmentsSortBy === "due" ? "default" : "ghost"} onClick={() => setAssignmentsSortBy("due")}>Due</Button>
                            <Button variant={assignmentsSortBy === "importance" ? "default" : "ghost"} onClick={() => setAssignmentsSortBy("importance")}>Importance</Button>
                        </div>
                        <Button variant="outline" onClick={() => downloadAssignments("json", getAllAssignmentsList())}>
                            <Download className="mr-2 h-4 w-4" /> JSON
                        </Button>
                        <Button variant="outline" onClick={() => downloadAssignments("csv", getAllAssignmentsList())}>
                            <Download className="mr-2 h-4 w-4" /> CSV
                        </Button>
                    </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {(() => {
                        const filtered = getAllAssignmentsList()
                        const sorted = filtered
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full">All Assignments ({sorted.length})</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="bottom" align="start" sideOffset={6} className="w-[860px] bg-background border shadow-xl">
                                    <ScrollArea className="h-[540px] w-full p-2">
                                        {sorted.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">No assignments found.</div>
                                        ) : (
                                            sorted.map((assignment, idx) => (
                                                <DropdownMenuItem key={`${assignment.id}-${idx}`} className="flex flex-col items-start space-y-2">
                                                    <div className="flex w-full items-center justify-between">
                                                        <span className="font-medium text-base">{assignment.title}</span>
                                                        <Badge variant={assignment.importance_level === 'high' || assignment.importance_level === 'critical' ? 'destructive' : assignment.importance_level === 'medium' ? 'default' : 'secondary'}>
                                                            {assignment.importance_level}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground w-full flex justify-between">
                                                        <span>Course: {courseLabel(assignment.course_id)}</span>
                                                        <span>Due: {new Date(assignment.due_at).toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-xs">Confidence: {assignment.user_confidence ?? 'N/A'}</div>
                                                    {plannerAssignmentId === assignment.id && (
                                                        <div className="w-full text-xs text-muted-foreground">Planner inputs: Hours/Day {hoursPerDay} • Weekends {allowWeekends ? 'Yes' : 'No'} • Deadline {plannerDeadline ? new Date(plannerDeadline).toLocaleString() : 'N/A'}</div>
                                                    )}
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </ScrollArea>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    })()}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>AI Planner</CardTitle>
                    <CardDescription>Import assignment details and generate an editable study plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label>Import Document</Label>
                            <Input type="file" accept=".txt,.md,.docx,.pdf" onChange={(e) => handleImportFile(e.target.files?.[0] || null)} />
                            <Input placeholder="Assignment Title" value={plannerTitle} onChange={(e) => setPlannerTitle(e.target.value)} />
                            <Label>Extracted/Pasted Details</Label>
                            <textarea className="w-full h-48 rounded-md border p-2" placeholder="Paste assignment details if needed" value={importText} onChange={(e) => setImportText(e.target.value)} />
                            <div className="text-xs text-muted-foreground">For best results, paste key instructions and rubric.</div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Course</Label>
                                <Input
                                    placeholder="Type course (optional)"
                                    className="col-span-3"
                                    value={plannerCourseText}
                                    onChange={(e) => setPlannerCourseText(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Deadline</Label>
                                <Input type="datetime-local" className="col-span-3" value={plannerDeadline} onChange={(e) => setPlannerDeadline(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Hours/Day</Label>
                                <Input type="number" min="0.5" step="0.5" className="col-span-3" value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.max(0.5, Math.min(12, parseFloat(e.target.value || '2'))))} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Allow Weekends</Label>
                                <div className="col-span-3"><Switch checked={allowWeekends} onCheckedChange={setAllowWeekends} /></div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={extractUsingAI} disabled={isExtracting}>{isExtracting ? "Extracting..." : "Extract using AI"}</Button>
                                <Button onClick={generatePlanner} disabled={isPlanning}>{isPlanning ? "Generating..." : "Generate Planner"}</Button>
                                {plannedSubtasks.length > 0 && (
                                    <Button variant="outline" onClick={addPlanToCalendar}>Add to Calendar</Button>
                                )}
                            </div>
                            {plannedSubtasks.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {plannedSubtasks.map((s, idx) => (
                                        <div key={`${s.id}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-6">
                                                <Input value={s.title} onChange={(e) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, title: e.target.value } : p))} />
                                            </div>
                                            <div className="col-span-2">
                                                <Input type="number" min="15" step="5" value={s.estimated_minutes} onChange={(e) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, estimated_minutes: Math.max(15, parseInt(e.target.value || '30', 10)) } : p))} />
                                            </div>
                                            <div className="col-span-2">
                                                <Input type="datetime-local" placeholder="Start" value={s.start_at || ''} onChange={(e) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, start_at: e.target.value } : p))} />
                                            </div>
                                            <div className="col-span-2">
                                                <Input type="datetime-local" placeholder="End" value={s.end_at || ''} onChange={(e) => setPlannedSubtasks(prev => prev.map((p, i) => i === idx ? { ...p, end_at: e.target.value } : p))} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {suggestionOpen && (
                <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Increase Hours Per Day?</DialogTitle>
                            <DialogDescription>
                                {workSummary ? `Estimated work ~${workSummary.totalHours}h over ${workSummary.daysAvailable} day(s).` : ''}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="text-sm">Your current daily limit may be too low to finish before the deadline.</div>
                            {suggestedHoursPerDay !== null && (
                                <div className="text-sm">Suggested daily hours: <span className="font-semibold">{suggestedHoursPerDay}h/day</span></div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSuggestionOpen(false)}>Keep Current</Button>
                            <Button onClick={() => { if (suggestedHoursPerDay) setHoursPerDay(suggestedHoursPerDay); setSuggestionOpen(false) }}>Apply Suggestion</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
