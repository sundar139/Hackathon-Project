"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { Plus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import api from "@/lib/api"
import { isAxiosError } from "axios"

interface Goal {
    id: number
    user_id: number
    name: string
    duration_minutes: number
    preferred_time_window?: string | null
    sessions_per_week: number
    created_at: string
    updated_at?: string | null
}

interface GoalSession {
    id: number
    goal_id: number
    start_time: string
    end_time: string
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "SKIPPED"
}

interface TimeSuggestion {
    start_time: string
    end_time: string
    reason?: string
}

interface SuggestionResponse {
    case: "A" | "B"
    suggestions?: TimeSuggestion[]
    message?: string
    alternatives?: Array<{
        type: string
        description?: string
    }>
    [key: string]: unknown
}

export default function GoalsPage() {
    const router = useRouter()
    const token = useAuthStore(state => state.token)
    const [goals, setGoals] = useState<Goal[]>([])
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newGoal, setNewGoal] = useState({
        name: "",
        duration_minutes: 30,
        preferred_time_window: "",
        sessions_per_week: 3
    })
    const [sessionsPerWeekInput, setSessionsPerWeekInput] = useState<string>("3")
    const [sessionsPerWeekError, setSessionsPerWeekError] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [selectedDates, setSelectedDates] = useState<Record<number, string>>({})
    const [suggestions, setSuggestions] = useState<Record<number, SuggestionResponse | undefined>>({})
    const [loadingSuggestions, setLoadingSuggestions] = useState<Record<number, boolean>>({})
    const [suggestionErrors, setSuggestionErrors] = useState<Record<number, string>>({})
    const [schedulingGoal, setSchedulingGoal] = useState<Record<number, boolean>>({}) // For backward compatibility with manual override
    const [schedulingSlot, setSchedulingSlot] = useState<Record<string, boolean>>({}) // Key: `${goalId}-${startTime}`
    const [scheduleConfirmations, setScheduleConfirmations] = useState<Record<number, boolean>>({})
    const [manualTimePickerOpen, setManualTimePickerOpen] = useState<Record<number, boolean>>({})
    const [manualTimes, setManualTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [selectedEditDate, setSelectedEditDate] = useState<Record<number, string>>({})
    const [pendingSelections, setPendingSelections] = useState<Record<number, Record<string, { start: string; end: string }>>>({})
    const [manualOverrideTimes, setManualOverrideTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [checkingOverlap, setCheckingOverlap] = useState<Record<number, boolean>>({})
    const [overlapWarningOpen, setOverlapWarningOpen] = useState<Record<number, boolean>>({})
    const [overlapWarningTimes, setOverlapWarningTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [goalSessions, setGoalSessions] = useState<Record<number, GoalSession[]>>({})
    const [multiSuggestions, setMultiSuggestions] = useState<Record<number, { date: string; suggestions: { start_time: string; end_time: string; reason?: string }[] }[]>>({})

    const fetchGoalSessions = useCallback(async (goalId: number) => {
        try {
            const response = await api.get(`/goals/${goalId}/sessions`)
            setGoalSessions(prev => ({ ...prev, [goalId]: response.data }))
        } catch {
            setGoalSessions(prev => ({ ...prev, [goalId]: [] }))
        }
    }, [])

    const fetchGoals = useCallback(async () => {
        try {
            const response = await api.get("/goals/")
            setGoals(response.data)
            // Fetch sessions for each goal
            for (const goal of response.data) {
                await fetchGoalSessions(goal.id)
            }
        } catch (error) {
            console.error("Failed to fetch goals", error)
        }
    }, [fetchGoalSessions])

    

    const calculateStreak = (goalId: number): number => {
        const sessions = goalSessions[goalId] || []
        // Filter for completed sessions
        const completedSessions = sessions.filter(s => s.status === "COMPLETED")
        if (completedSessions.length === 0) return 0

        // Get unique dates when sessions were completed (normalize to date string YYYY-MM-DD)
        const completedDates = new Set<string>()
        completedSessions.forEach(session => {
            const date = new Date(session.start_time)
            date.setHours(0, 0, 0, 0)
            completedDates.add(date.toISOString().split('T')[0])
        })

        // Calculate consecutive days from today backwards
        let streak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Start from today and count backwards
        const checkDate = new Date(today)
        
        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0]
            if (completedDates.has(dateStr)) {
                streak++
                checkDate.setDate(checkDate.getDate() - 1)
            } else {
                // Stop on first day without a completed session
                break
            }
        }

        return streak
    }

    const calculateWeeklyProgress = (goalId: number): number => {
        const sessions = goalSessions[goalId] || []
        
        // Get start of current week (Sunday)
        const today = new Date()
        const dayOfWeek = today.getDay()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - dayOfWeek)
        startOfWeek.setHours(0, 0, 0, 0)

        // Count scheduled/completed sessions this week
        const thisWeekSessions = sessions.filter(session => {
            const sessionDate = new Date(session.start_time)
            return sessionDate >= startOfWeek && 
                   (session.status === "SCHEDULED" || session.status === "COMPLETED" || session.status === "IN_PROGRESS")
        })

        return thisWeekSessions.length
    }

    useEffect(() => {
        if (!token) {
            router.replace('/login')
            return
        }
        const id = setTimeout(() => {
            fetchGoals()
        }, 0)
        return () => {
            clearTimeout(id)
        }
    }, [token, router, fetchGoals])

    const handleCreateGoal = async () => {
        if (!newGoal.name.trim()) {
            return
        }
        setIsLoading(true)
        try {
            await api.post("/goals/", {
                name: newGoal.name,
                duration_minutes: newGoal.duration_minutes,
                preferred_time_window: newGoal.preferred_time_window || null,
                sessions_per_week: newGoal.sessions_per_week
            })
            // Reset form
            setNewGoal({
                name: "",
                duration_minutes: 30,
                preferred_time_window: "",
                sessions_per_week: 3
            })
            setSessionsPerWeekInput("3")
            setSessionsPerWeekError("")
            setIsAddDialogOpen(false)
            // Refresh the list
            await fetchGoals()
            // New goal will have its sessions fetched in fetchGoals
        } catch (error) {
            console.error("Failed to create goal", error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchAutoSuggestions = useCallback(async (goal: Goal) => {
        try {
            const count = Math.max(1, goal.sessions_per_week || 1)
            const agg: { date: string; suggestions: { start_time: string; end_time: string; reason?: string }[] }[] = []
            const selections: Record<string, { start: string; end: string }> = {}
            let dayOffset = 0
            const today = new Date()
            today.setHours(0,0,0,0)

            const toLocalInput = (iso: string) => {
                const d = new Date(iso)
                const off = d.getTimezoneOffset()
                const local = new Date(d.getTime() - off * 60000)
                return local.toISOString().slice(0, 16)
            }
            const toLocalDateStr = (d: Date) => {
                const y = d.getFullYear()
                const m = String(d.getMonth()+1).padStart(2,'0')
                const dd = String(d.getDate()).padStart(2,'0')
                return `${y}-${m}-${dd}`
            }
            // Fetch existing schedule blocks once for availability checks
            let scheduleBlocks: Array<{ start_at: string; end_at: string }> = []
            try {
                const res = await api.get("/schedule/")
                scheduleBlocks = (res?.data as Array<{ start_at: string; end_at: string }>) || []
            } catch {}
            const isFree = (start: Date, end: Date) => {
                const startMs = start.getTime()
                const endMs = end.getTime()
                return !scheduleBlocks.some(b => {
                    const bs = new Date(b.start_at).getTime()
                    const be = new Date(b.end_at).getTime()
                    return startMs < be && endMs > bs
                })
            }
            const windowStartHour = (goal.preferred_time_window || '').toLowerCase().includes('evening') ? 18
                : (goal.preferred_time_window || '').toLowerCase().includes('afternoon') ? 13
                : 9
            const windowEndHour = (goal.preferred_time_window || '').toLowerCase().includes('evening') ? 21
                : (goal.preferred_time_window || '').toLowerCase().includes('afternoon') ? 17
                : 12

            while (agg.length < count && dayOffset < 120) {
                const dLocal = new Date(today)
                dLocal.setDate(today.getDate() + dayOffset)
                const dStr = toLocalDateStr(dLocal)
                if (dLocal < today) { dayOffset++; continue }
                try {
                    const response = await api.post(`/goals/${goal.id}/suggest-times`, { date: dStr })
                    const list = (response.data?.suggestions || []) as { start_time: string; end_time: string; reason?: string }[]
                    if (list && list.length > 0) {
                        const first = list[0]
                        agg.push({ date: dStr, suggestions: [first] })
                        selections[dStr] = { start: toLocalInput(first.start_time), end: toLocalInput(first.end_time) }
                    } else {
                        // Fallback: pick first available slot in preferred window with 30-min step
                        const startCandidate = new Date(`${dStr}T${String(windowStartHour).padStart(2,'0')}:00`)
                        const windowEnd = new Date(`${dStr}T${String(windowEndHour).padStart(2,'0')}:00`)
                        let cursor = new Date(startCandidate)
                        const durationMin = goal.duration_minutes || 30
                        let found: { start: Date; end: Date } | null = null
                        while (cursor.getTime() + durationMin*60000 <= windowEnd.getTime()) {
                            const endC = new Date(cursor.getTime() + durationMin*60000)
                            if (isFree(cursor, endC)) { found = { start: cursor, end: endC }; break }
                            cursor = new Date(cursor.getTime() + 30*60000)
                        }
                        if (found) {
                            agg.push({ date: dStr, suggestions: [{ start_time: found.start.toISOString(), end_time: found.end.toISOString(), reason: undefined }] })
                            selections[dStr] = { start: toLocalInput(found.start.toISOString()), end: toLocalInput(found.end.toISOString()) }
                        }
                    }
                } catch {}
                dayOffset++
            }
            setMultiSuggestions(prev => ({ ...prev, [goal.id]: agg }))
            setPendingSelections(prev => ({ ...prev, [goal.id]: selections }))
        } catch {}
    }, [])

    useEffect(() => {
        if (goals.length > 0) {
            goals.forEach(g => fetchAutoSuggestions(g))
        }
    }, [goals, fetchAutoSuggestions])

    const openEditFromSuggestion = (goalId: number, startISO: string, endISO: string, dateStr?: string) => {
        const toLocalInput = (iso: string) => {
            const d = new Date(iso)
            const off = d.getTimezoneOffset()
            const local = new Date(d.getTime() - off * 60000)
            return local.toISOString().slice(0, 16)
        }
        const start = toLocalInput(startISO)
        const end = toLocalInput(endISO)
        setManualTimes({ ...manualTimes, [goalId]: { start, end } })
        if (dateStr) setSelectedEditDate(prev => ({ ...prev, [goalId]: dateStr }))
        setManualTimePickerOpen({ ...manualTimePickerOpen, [goalId]: true })
    }
    const handleFindTimes = async (goalId: number, durationOverride?: number) => {
        const date = selectedDates[goalId]
        if (!date) {
            setSuggestionErrors({ ...suggestionErrors, [goalId]: "Please select a date first" })
            return
        }

        setLoadingSuggestions({ ...loadingSuggestions, [goalId]: true })
        setSuggestionErrors({ ...suggestionErrors, [goalId]: "" })
        setSuggestions({ ...suggestions, [goalId]: undefined })

        try {
            interface SuggestTimesPayload { date: string; duration_minutes?: number }
            const payload: SuggestTimesPayload = { date }
            if (durationOverride !== undefined) {
                payload.duration_minutes = durationOverride
            }
            const response = await api.post(`/goals/${goalId}/suggest-times`, payload)
            setSuggestions({ ...suggestions, [goalId]: response.data })
        } catch (error: unknown) {
            const errorMessage = isAxiosError(error)
                ? (error.response?.data as { detail?: string })?.detail || error.message
                : (error instanceof Error ? error.message : "Failed to get suggestions")
            setSuggestionErrors({ ...suggestionErrors, [goalId]: errorMessage })
            console.error("Failed to get time suggestions", error)
        } finally {
            setLoadingSuggestions({ ...loadingSuggestions, [goalId]: false })
        }
    }

    const handleScheduleSession = async (goalId: number, startTime: string, endTime: string, slotKey?: string) => {
        // Create a unique key for this specific slot if not provided
        const uniqueSlotKey = slotKey || `${goalId}-${startTime}`
        
        // Prevent duplicate scheduling if already in progress for this specific slot
        if (schedulingSlot[uniqueSlotKey]) {
            return
        }

        // Set loading state for this specific slot
        setSchedulingSlot(prev => ({ ...prev, [uniqueSlotKey]: true }))
        // Also set the general goal loading state for backward compatibility with manual override
        setSchedulingGoal(prev => ({ ...prev, [goalId]: true }))
        setScheduleConfirmations(prev => ({ ...prev, [goalId]: false }))

        try {
            await api.post(`/goals/${goalId}/schedule-session`, {
                start_time: startTime,
                end_time: endTime,
                status: "SCHEDULED"
            })
            setScheduleConfirmations(prev => ({ ...prev, [goalId]: true }))
            // Refresh sessions after scheduling
            await fetchGoalSessions(goalId)
            // Notify dashboard to refresh schedule blocks
            window.dispatchEvent(new Event('scheduleUpdated'))
            // Clear confirmation after 3 seconds
            setTimeout(() => {
                setScheduleConfirmations(prev => ({ ...prev, [goalId]: false }))
                // Optionally clear suggestions
                setSuggestions(prev => ({ ...prev, [goalId]: undefined }))
            }, 3000)
        } catch (error: unknown) {
            const errorMessage = isAxiosError(error)
                ? (error.response?.data as { detail?: string })?.detail || error.message
                : (error instanceof Error ? error.message : "Failed to schedule session")
            setSuggestionErrors(prev => ({ ...prev, [goalId]: errorMessage }))
            console.error("Failed to schedule session", error)
        } finally {
            // Clear loading state for this specific slot and check if we should clear goal-level state
            setSchedulingSlot(prev => {
                const newState = { ...prev }
                delete newState[uniqueSlotKey]
                
                // Check if any other slots for this goal are still scheduling
                const hasOtherSlotsScheduling = Object.keys(newState).some(key => {
                    return key.startsWith(`${goalId}-`) && newState[key]
                })
                
                // Clear goal-level state if no other slots are scheduling
                // Use setTimeout to ensure this happens after state update
                if (!hasOtherSlotsScheduling) {
                    setTimeout(() => {
                        setSchedulingGoal(prevGoal => {
                            const newGoalState = { ...prevGoal }
                            delete newGoalState[goalId]
                            return newGoalState
                        })
                    }, 0)
                }
                
                return newState
            })
        }
    }

    const handleTryTomorrow = (goalId: number) => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        setSelectedDates({ ...selectedDates, [goalId]: tomorrowStr })
        // Wait a tick for state to update, then call suggest-times
        setTimeout(() => {
            handleFindTimes(goalId)
        }, 0)
    }

    const handleTryShorterDuration = (goalId: number) => {
        const goal = goals.find(g => g.id === goalId)
        if (!goal) return
        const shorterDuration = Math.max(15, Math.floor(goal.duration_minutes * 0.7))
        handleFindTimes(goalId, shorterDuration)
    }

    const handleScheduleAnyway = (goalId: number) => {
        setManualTimePickerOpen({ ...manualTimePickerOpen, [goalId]: true })
        const date = selectedDates[goalId]
        if (date) {
            const goal = goals.find(g => g.id === goalId)
            const duration = goal?.duration_minutes || 30
            const startTime = `${date}T10:00`
            const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString().slice(0, 16)
            setManualTimes({ ...manualTimes, [goalId]: { start: startTime, end: endTime } })
        }
    }

    const handleManualSchedule = (goalId: number) => {
        const times = manualTimes[goalId]
        if (!times) return
        // Convert datetime-local format to ISO string
        const startISO = new Date(times.start).toISOString()
        const endISO = new Date(times.end).toISOString()
        handleScheduleSession(goalId, startISO, endISO)
        setManualTimePickerOpen({ ...manualTimePickerOpen, [goalId]: false })
    }

    const checkOverlapAndSchedule = async (goalId: number) => {
        const times = manualOverrideTimes[goalId]
        if (!times || !times.start || !times.end) {
            setSuggestionErrors({ ...suggestionErrors, [goalId]: "Please enter both start and end times" })
            return
        }

        setCheckingOverlap({ ...checkingOverlap, [goalId]: true })
        setSuggestionErrors({ ...suggestionErrors, [goalId]: "" })

        try {
            // Fetch schedule blocks for the date to check overlaps
            const response = await api.get("/schedule/", { params: { limit: 100 } })
            const scheduleBlocks: { start_at: string; end_at: string }[] = response.data || []

            // Check for overlaps
            const startTime = new Date(times.start).getTime()
            const endTime = new Date(times.end).getTime()
            const hasOverlap = scheduleBlocks.some((block) => {
                const blockStart = new Date(block.start_at).getTime()
                const blockEnd = new Date(block.end_at).getTime()
                return (startTime < blockEnd && endTime > blockStart)
            })

            if (hasOverlap) {
                setOverlapWarningTimes({ ...overlapWarningTimes, [goalId]: times })
                setOverlapWarningOpen({ ...overlapWarningOpen, [goalId]: true })
                                            } else {
                const startISO = new Date(times.start).toISOString()
                const endISO = new Date(times.end).toISOString()
                await handleScheduleSession(goalId, startISO, endISO)
                setManualOverrideTimes({ ...manualOverrideTimes, [goalId]: { start: "", end: "" } })
                setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: true })
                setTimeout(() => {
                    setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: false })
                }, 3000)
            }
        } catch (error: unknown) {
            const errorMessage = isAxiosError(error)
                ? (error.response?.data as { detail?: string })?.detail || error.message
                : (error instanceof Error ? error.message : "Failed to check schedule")
            setSuggestionErrors({ ...suggestionErrors, [goalId]: errorMessage })
            console.error("Failed to check overlap", error)
        } finally {
            setCheckingOverlap({ ...checkingOverlap, [goalId]: false })
        }
    }

    const handleScheduleAnywayFromWarning = async (goalId: number) => {
        const times = overlapWarningTimes[goalId]
        if (!times) return

        setOverlapWarningOpen({ ...overlapWarningOpen, [goalId]: false })
        const startISO = new Date(times.start).toISOString()
        const endISO = new Date(times.end).toISOString()
        await handleScheduleSession(goalId, startISO, endISO)
        // Clear manual override times after successful scheduling
        setManualOverrideTimes({ ...manualOverrideTimes, [goalId]: { start: "", end: "" } })
        // Show confirmation message
        setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: true })
        setTimeout(() => {
            setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: false })
        }, 3000)
    }

    const handlePickAnotherTime = (goalId: number) => {
        setOverlapWarningOpen({ ...overlapWarningOpen, [goalId]: false })
    }

    const handleManualOverrideSave = async (goalId: number) => {
        const times = manualOverrideTimes[goalId]
        if (!times || !times.start || !times.end) return
        const startISO = new Date(times.start).toISOString()
        const endISO = new Date(times.end).toISOString()
        await handleScheduleSession(goalId, startISO, endISO)
        setManualOverrideTimes({ ...manualOverrideTimes, [goalId]: { start: "", end: "" } })
        setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: true })
        setTimeout(() => {
            setScheduleConfirmations({ ...scheduleConfirmations, [goalId]: false })
        }, 3000)
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Goals</h2>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">Your Personal Goals</h1>
                        <p className="text-sm text-gray-600">
                            Track and manage your personal goals. Schedule sessions and build consistent habits.
                        </p>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Goal
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Goal</DialogTitle>
                            <DialogDescription>
                                Create a new goal to track your progress.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Goal Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Exercise regularly"
                                    value={newGoal.name}
                                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    min="1"
                                    value={newGoal.duration_minutes}
                                    onChange={(e) => setNewGoal({ ...newGoal, duration_minutes: parseInt(e.target.value) || 30 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timeWindow">Preferred Time Window (optional)</Label>
                                <Select
                                    value={newGoal.preferred_time_window || undefined}
                                    onValueChange={(value) => setNewGoal({ ...newGoal, preferred_time_window: value === "none" ? "" : value })}
                                >
                                    <SelectTrigger id="timeWindow">
                                        <SelectValue placeholder="Select a time window" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="Morning">Morning</SelectItem>
                                        <SelectItem value="Afternoon">Afternoon</SelectItem>
                                        <SelectItem value="Evening">Evening</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sessionsPerWeek">Sessions per Week</Label>
                                <Input
                                    id="sessionsPerWeek"
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={sessionsPerWeekInput}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setSessionsPerWeekInput(v)
                                        const n = parseInt(v, 10)
                                        if (Number.isNaN(n)) {
                                            setSessionsPerWeekError("")
                                            return
                                        }
                                        if (n < 1) {
                                            setSessionsPerWeekError("Enter a number between 1 and 7")
                                        } else if (n > 7) {
                                            setSessionsPerWeekError("Enter a number up to 7")
                                        } else {
                                            setSessionsPerWeekError("")
                                            setNewGoal({ ...newGoal, sessions_per_week: n })
                                        }
                                    }}
                                />
                                {sessionsPerWeekError && (
                                    <div className="text-xs text-red-600">{sessionsPerWeekError}</div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateGoal} disabled={isLoading || !newGoal.name.trim() || !!sessionsPerWeekError}>
                                {isLoading ? "Creating..." : "Create Goal"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {goals.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="pt-6">
                            <p className="text-center text-muted-foreground">
                                No goals yet. Click &quot;Add Goal&quot; to get started.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                    {goals.map((goal) => (
                        <Card key={goal.id}>
                            <CardHeader>
                                <CardTitle>{goal.name}</CardTitle>
                                <CardDescription>
                                    {goal.duration_minutes} minutes per session
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Streak and Weekly Progress */}
                                <div className="flex items-center gap-6 pb-4 border-b">
                                    <div>
                                        <span className="font-semibold text-xl">{calculateStreak(goal.id)}</span>
                                        <span className="text-sm text-muted-foreground ml-1">day streak</span>
                                    </div>
                                    <div className="h-8 w-px bg-border" />
                                    <div>
                                        <span className="font-semibold text-xl">{calculateWeeklyProgress(goal.id)}</span>
                                        <span className="text-sm text-muted-foreground"> / </span>
                                        <span className="text-sm text-muted-foreground">{goal.sessions_per_week} this week</span>
                                    </div>
                                </div>

                                {/* Goal Details */}
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="font-medium">Sessions per week:</span> {goal.sessions_per_week}
                                    </div>
                                    {goal.preferred_time_window && (
                                        <div>
                                            <span className="font-medium">Preferred time:</span> {goal.preferred_time_window}
                                        </div>
                                    )}
                                </div>
                                
                                {/* AI Time Suggestions Section */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Suggested Timings</h3>
                                    </div>
                                    {multiSuggestions[goal.id] && multiSuggestions[goal.id].length > 0 && (
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                            {multiSuggestions[goal.id]
                                                .filter((day) => {
                                                    const [y,m,dd] = day.date.split('-').map(Number)
                                                    const dLocal = new Date(y, (m||1)-1, dd||1)
                                                    const todayLocal = new Date()
                                                    todayLocal.setHours(0,0,0,0)
                                                    dLocal.setHours(0,0,0,0)
                                                    return dLocal.getTime() >= todayLocal.getTime()
                                                })
                                                .map((day) => (
                                                <div key={`${goal.id}-${day.date}`} className="space-y-2">
                                                    <p className="text-xs font-medium">{new Date(day.date).toLocaleDateString()}</p>
                                                    <div className="space-y-2">
                                                        {day.suggestions.slice(0, 1).map((time, idx) => {
                                                            
                                                            return (
                                                                <div
                                                                    key={`autosuggestion-${goal.id}-${idx}-${time.start_time}`}
                                                                    className="text-xs bg-muted p-2 rounded space-y-2 cursor-pointer"
                                                                    onClick={() => openEditFromSuggestion(goal.id, time.start_time, time.end_time, day.date)}
                                                                >
                                                                    <div>
                                                                        <span className="font-medium">
                                                                            {new Date(time.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                        {" - "}
                                                                        <span className="font-medium">
                                                                            {new Date(time.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {suggestionErrors[goal.id] && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                            {suggestionErrors[goal.id]}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={async () => {
                                                const entries = Object.entries(pendingSelections[goal.id] || {})
                                                for (const [, times] of entries) {
                                                    const startISO = new Date(times.start).toISOString()
                                                    const endISO = new Date(times.end).toISOString()
                                                    await handleScheduleSession(goal.id, startISO, endISO)
                                                }
                                            }}
                                            disabled={!pendingSelections[goal.id] || Object.keys(pendingSelections[goal.id]).length === 0}
                                        >
                                            Confirm
                                        </Button>
                                    </div>

                                    {/* Suggestions above cover multiple upcoming days */}

                                    {/* Case B: No Good Slots */}
                                    {suggestions[goal.id]?.case === "B" && !suggestionErrors[goal.id] && (
                                        <div className="space-y-3">
                                            <div className="text-xs bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                                    <div className="flex-1 space-y-2">
                                                        <p className="text-yellow-800 font-medium">
                                                            {suggestions[goal.id]?.message || "No good time slots found"}
                                                        </p>
                                                        <div className="flex flex-col gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full text-xs"
                                                                onClick={() => handleTryShorterDuration(goal.id)}
                                                                disabled={loadingSuggestions[goal.id]}
                                                            >
                                                                Try shorter duration
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full text-xs"
                                                                onClick={() => handleTryTomorrow(goal.id)}
                                                                disabled={loadingSuggestions[goal.id]}
                                                            >
                                                                Try tomorrow instead
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full text-xs"
                                                                onClick={() => handleScheduleAnyway(goal.id)}
                                                            >
                                                                Schedule anyway
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Manual Time Picker Dialog */}
                                    <Dialog 
                                        open={manualTimePickerOpen[goal.id] || false} 
                                        onOpenChange={(open) => setManualTimePickerOpen({ ...manualTimePickerOpen, [goal.id]: open })}
                                    >
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Edit Time</DialogTitle>
                                                <DialogDescription>
                                                    Select start and end time for this day.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-start-${goal.id}`}>Start Time</Label>
                                                    <DateTimePicker
                                                        id={`manual-start-${goal.id}`}
                                                        value={manualTimes[goal.id]?.start || ""}
                                                        onChange={(start) => {
                                                            const goalObj = goals.find(g => g.id === goal.id)
                                                            const duration = goalObj?.duration_minutes || 30
                                                            const end = new Date(new Date(start).getTime() + duration * 60000).toISOString().slice(0, 16)
                                                            setManualTimes({ ...manualTimes, [goal.id]: { start, end } })
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-end-${goal.id}`}>End Time</Label>
                                                    <DateTimePicker
                                                        id={`manual-end-${goal.id}`}
                                                        value={manualTimes[goal.id]?.end || ""}
                                                        onChange={(end) => {
                                                            const start = manualTimes[goal.id]?.start || ""
                                                            setManualTimes({ ...manualTimes, [goal.id]: { start, end } })
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button 
                                                    variant="outline" 
                                                    onClick={() => setManualTimePickerOpen({ ...manualTimePickerOpen, [goal.id]: false })}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button 
                                                    onClick={() => {
                                                        const times = manualTimes[goal.id]
                                                        if (!times) return
                                                        const dateKey = selectedEditDate[goal.id] || (times.start.split('T')[0])
                                                        setPendingSelections(prev => ({
                                                            ...prev,
                                                            [goal.id]: { ...(prev[goal.id] || {}), [dateKey]: { start: times.start, end: times.end } }
                                                        }))
                                                        setManualTimePickerOpen({ ...manualTimePickerOpen, [goal.id]: false })
                                                    }}
                                                    disabled={!manualTimes[goal.id]?.start || !manualTimes[goal.id]?.end}
                                                >
                                                    Save
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    {/* Manual Override Section removed */}

                                    {/* Overlap Warning Dialog */}
                                    <Dialog
                                        open={overlapWarningOpen[goal.id] || false}
                                        onOpenChange={(open) => setOverlapWarningOpen({ ...overlapWarningOpen, [goal.id]: open })}
                                    >
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                                    Time Conflict Detected
                                                </DialogTitle>
                                                <DialogDescription>
                                                    This time overlaps with study blocks. Are you sure?
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                {overlapWarningTimes[goal.id] && (
                                                    <div className="text-sm space-y-1">
                                                        <div>
                                                            <span className="font-medium">Start:</span>{" "}
                                                            {new Date(overlapWarningTimes[goal.id].start).toLocaleString()}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">End:</span>{" "}
                                                            {new Date(overlapWarningTimes[goal.id].end).toLocaleString()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handlePickAnotherTime(goal.id)}
                                                >
                                                    Pick another time
                                                </Button>
                                                <Button
                                                    onClick={() => handleScheduleAnywayFromWarning(goal.id)}
                                                    disabled={schedulingGoal[goal.id]}
                                                >
                                                    {schedulingGoal[goal.id] ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Scheduling...
                                                        </>
                                                    ) : (
                                                        "Schedule anyway"
                                                    )}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                            </CardContent>
                        </Card>
                    ))}
                    </>
                )}
                </div>
            </div>
        </div>
    )
}
