"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { Plus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
    [key: string]: any
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
    const [isLoading, setIsLoading] = useState(false)
    const [selectedDates, setSelectedDates] = useState<Record<number, string>>({})
    const [suggestions, setSuggestions] = useState<Record<number, SuggestionResponse>>({})
    const [loadingSuggestions, setLoadingSuggestions] = useState<Record<number, boolean>>({})
    const [suggestionErrors, setSuggestionErrors] = useState<Record<number, string>>({})
    const [schedulingGoal, setSchedulingGoal] = useState<Record<number, boolean>>({}) // For backward compatibility with manual override
    const [schedulingSlot, setSchedulingSlot] = useState<Record<string, boolean>>({}) // Key: `${goalId}-${startTime}`
    const [scheduleConfirmations, setScheduleConfirmations] = useState<Record<number, boolean>>({})
    const [manualTimePickerOpen, setManualTimePickerOpen] = useState<Record<number, boolean>>({})
    const [manualTimes, setManualTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [manualOverrideTimes, setManualOverrideTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [checkingOverlap, setCheckingOverlap] = useState<Record<number, boolean>>({})
    const [overlapWarningOpen, setOverlapWarningOpen] = useState<Record<number, boolean>>({})
    const [overlapWarningTimes, setOverlapWarningTimes] = useState<Record<number, { start: string; end: string }>>({})
    const [goalSessions, setGoalSessions] = useState<Record<number, GoalSession[]>>({})

    const fetchGoals = async () => {
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
    }

    const fetchGoalSessions = async (goalId: number) => {
        try {
            const response = await api.get(`/goals/${goalId}/sessions`)
            setGoalSessions({ ...goalSessions, [goalId]: response.data })
        } catch (error) {
            console.error(`Failed to fetch sessions for goal ${goalId}`, error)
            // Set empty array if fetch fails
            setGoalSessions({ ...goalSessions, [goalId]: [] })
        }
    }

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
        let checkDate = new Date(today)
        
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

    const calculateWeeklyProgress = (goalId: number, sessionsPerWeek: number): number => {
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
    }, [token, router])

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

    const handleFindTimes = async (goalId: number, durationOverride?: number) => {
        const date = selectedDates[goalId]
        if (!date) {
            setSuggestionErrors({ ...suggestionErrors, [goalId]: "Please select a date first" })
            return
        }

        setLoadingSuggestions({ ...loadingSuggestions, [goalId]: true })
        setSuggestionErrors({ ...suggestionErrors, [goalId]: "" })
        setSuggestions({ ...suggestions, [goalId]: undefined as any })

        try {
            const payload: any = { date: date }
            if (durationOverride !== undefined) {
                payload.duration_minutes = durationOverride
            }
            const response = await api.post(`/goals/${goalId}/suggest-times`, payload)
            setSuggestions({ ...suggestions, [goalId]: response.data })
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail || error.message || "Failed to get suggestions"
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
                setSuggestions(prev => ({ ...prev, [goalId]: undefined as any }))
            }, 3000)
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail || error.message || "Failed to schedule session"
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
            const startDate = new Date(times.start).toISOString().split('T')[0]
            const response = await api.get("/schedule/", { params: { limit: 100 } })
            const scheduleBlocks = response.data || []

            // Check for overlaps
            const startTime = new Date(times.start).getTime()
            const endTime = new Date(times.end).getTime()
            const hasOverlap = scheduleBlocks.some((block: any) => {
                const blockStart = new Date(block.start_at).getTime()
                const blockEnd = new Date(block.end_at).getTime()
                // Check if time ranges overlap
                return (startTime < blockEnd && endTime > blockStart)
            })

            if (hasOverlap) {
                // Show warning dialog
                setOverlapWarningTimes({ ...overlapWarningTimes, [goalId]: times })
                setOverlapWarningOpen({ ...overlapWarningOpen, [goalId]: true })
                                            } else {
                // No overlap, schedule directly
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
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail || error.message || "Failed to check schedule"
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
                                    value={newGoal.sessions_per_week}
                                    onChange={(e) => setNewGoal({ ...newGoal, sessions_per_week: parseInt(e.target.value) || 3 })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateGoal} disabled={isLoading || !newGoal.name.trim()}>
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
                    goals.map((goal) => (
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
                                        <span className="font-semibold text-xl">{calculateWeeklyProgress(goal.id, goal.sessions_per_week)}</span>
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
                                    <div className="text-xs text-muted-foreground pt-2">
                                        Created {new Date(goal.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                
                                {/* AI Time Suggestions Section */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">AI Time Suggestions</h3>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Let AI find the best times for your goal session
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={`date-${goal.id}`} className="text-xs font-medium">
                                                Select Date
                                            </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id={`date-${goal.id}`}
                                                type="date"
                                                value={selectedDates[goal.id] || ""}
                                                onChange={(e) => 
                                                    setSelectedDates({ ...selectedDates, [goal.id]: e.target.value })
                                                }
                                                className="flex-1"
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                            <Button
                                                onClick={() => handleFindTimes(goal.id)}
                                                disabled={loadingSuggestions[goal.id] || !selectedDates[goal.id]}
                                                size="sm"
                                            >
                                                {loadingSuggestions[goal.id] ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    "Let AI find times"
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Error Message */}
                                    {suggestionErrors[goal.id] && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                            {suggestionErrors[goal.id]}
                                        </div>
                                    )}

                                    {/* Case A: Suggestions Display */}
                                    {suggestions[goal.id] && !suggestionErrors[goal.id] && suggestions[goal.id].case === "A" && (
                                        <div className="space-y-2">
                                            {scheduleConfirmations[goal.id] && (
                                                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Added to calendar
                                                </div>
                                            )}
                                            {suggestions[goal.id].suggestions && suggestions[goal.id].suggestions!.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium">Suggested Times:</p>
                                                    <div className="space-y-2">
                                                        {suggestions[goal.id].suggestions!.slice(0, 3).map((time, idx) => {
                                                            const slotKey = `${goal.id}-${time.start_time}`
                                                            const isThisSlotScheduling = schedulingSlot[slotKey] || false
                                                            
                                                            const handleScheduleThisSlot = (e: React.MouseEvent) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                if (!isThisSlotScheduling) {
                                                                    handleScheduleSession(goal.id, time.start_time, time.end_time, slotKey)
                                                                }
                                                            }
                                                            
                                                            return (
                                                                <div
                                                                    key={`suggestion-${goal.id}-${idx}-${time.start_time}`}
                                                                    className="text-xs bg-muted p-2 rounded space-y-2"
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
                                                                    {time.reason && (
                                                                        <div className="text-muted-foreground">
                                                                            {time.reason}
                                                                        </div>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="w-full"
                                                                        onClick={handleScheduleThisSlot}
                                                                        disabled={isThisSlotScheduling || schedulingGoal[goal.id]}
                                                                        type="button"
                                                                    >
                                                                        {isThisSlotScheduling ? (
                                                                            <>
                                                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                                                Scheduling...
                                                                            </>
                                                                        ) : (
                                                                            "Schedule this"
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Case B: No Good Slots */}
                                    {suggestions[goal.id] && !suggestionErrors[goal.id] && suggestions[goal.id].case === "B" && (
                                        <div className="space-y-3">
                                            <div className="text-xs bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                                    <div className="flex-1 space-y-2">
                                                        <p className="text-yellow-800 font-medium">
                                                            {suggestions[goal.id].message || "No good time slots found"}
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
                                                <DialogTitle>Schedule Session</DialogTitle>
                                                <DialogDescription>
                                                    Manually select start and end times for your session.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-start-${goal.id}`}>Start Time</Label>
                                                    <Input
                                                        id={`manual-start-${goal.id}`}
                                                        type="datetime-local"
                                                        value={manualTimes[goal.id]?.start || ""}
                                                        onChange={(e) => {
                                                            const start = e.target.value
                                                            const goalObj = goals.find(g => g.id === goal.id)
                                                            const duration = goalObj?.duration_minutes || 30
                                                            const end = new Date(new Date(start).getTime() + duration * 60000).toISOString().slice(0, 16)
                                                            setManualTimes({ ...manualTimes, [goal.id]: { start, end } })
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-end-${goal.id}`}>End Time</Label>
                                                    <Input
                                                        id={`manual-end-${goal.id}`}
                                                        type="datetime-local"
                                                        value={manualTimes[goal.id]?.end || ""}
                                                        onChange={(e) => {
                                                            const start = manualTimes[goal.id]?.start || ""
                                                            setManualTimes({ ...manualTimes, [goal.id]: { start, end: e.target.value } })
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
                                                    onClick={() => handleManualSchedule(goal.id)}
                                                    disabled={!manualTimes[goal.id]?.start || !manualTimes[goal.id]?.end || schedulingGoal[goal.id]}
                                                >
                                                    {schedulingGoal[goal.id] ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Scheduling...
                                                        </>
                                                    ) : (
                                                        "Schedule"
                                                    )}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    {/* Manual Override Section */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <div>
                                            <h3 className="text-sm font-semibold mb-1">Manual Override</h3>
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Pick a custom time if you don&apos;t like AI suggestions
                                            </p>
                                        </div>
                                        {scheduleConfirmations[goal.id] && (
                                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Added to calendar
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-start-override-${goal.id}`} className="text-xs font-medium">
                                                        Start Time
                                                    </Label>
                                                    <Input
                                                        id={`manual-start-override-${goal.id}`}
                                                        type="datetime-local"
                                                        value={manualOverrideTimes[goal.id]?.start || ""}
                                                        onChange={(e) => {
                                                            const start = e.target.value
                                                            const goalObj = goals.find(g => g.id === goal.id)
                                                            const duration = goalObj?.duration_minutes || 30
                                                            const end = new Date(new Date(start).getTime() + duration * 60000).toISOString().slice(0, 16)
                                                            setManualOverrideTimes({ ...manualOverrideTimes, [goal.id]: { start, end: manualOverrideTimes[goal.id]?.end || end } })
                                                        }}
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`manual-end-override-${goal.id}`} className="text-xs font-medium">
                                                        End Time
                                                    </Label>
                                                    <Input
                                                        id={`manual-end-override-${goal.id}`}
                                                        type="datetime-local"
                                                        value={manualOverrideTimes[goal.id]?.end || ""}
                                                        onChange={(e) => {
                                                            const start = manualOverrideTimes[goal.id]?.start || ""
                                                            setManualOverrideTimes({ ...manualOverrideTimes, [goal.id]: { start, end: e.target.value } })
                                                        }}
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => checkOverlapAndSchedule(goal.id)}
                                                    disabled={checkingOverlap[goal.id] || !manualOverrideTimes[goal.id]?.start || !manualOverrideTimes[goal.id]?.end}
                                                >
                                                    {checkingOverlap[goal.id] ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                            Checking...
                                                        </>
                                                    ) : (
                                                        "Check availability"
                                                    )}
                                                </Button>
                                        </div>
                                    </div>

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
                                </div>
                            </CardContent>
                        </Card>
                    ))
                    )}
                </div>
            </div>
        </div>
    )
}
