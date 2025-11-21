"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { ModernCalendar } from "@/components/dashboard/modern-calendar"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { ActivitySection } from "@/components/dashboard/activity-section"
import { ScheduleView } from "@/components/dashboard/schedule-view"
import { InsightsCard } from "@/components/dashboard/insights-card"
import { CheckInCard } from "@/components/dashboard/check-in-card"
import { ChatbotButton } from "@/components/dashboard/chatbot-button"
import api from "@/lib/api"

interface Assignment {
  id: number
  title: string
  due_at: string
  importance_level: string
  status?: string
  estimated_minutes?: number
  course_id?: number
  subtasks?: Array<{ id: number }>
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

export default function DashboardPage() {
  const router = useRouter()
  const token = useAuthStore(state => state.token)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [scheduleBlocks, setScheduleBlocks] = useState<Array<{ id: number; title: string; start_at: string; end_at: string; type?: string; assignment_id?: number; importance_level?: string }>>([])
  const [courses, setCourses] = useState<Array<{ id: number; name: string; code?: string }>>([])
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()) // Today by default
  const [userName, setUserName] = useState("Student")
  const [greeting, setGreeting] = useState("Good Morning")

  const updateGreeting = useCallback(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 18) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")
  }, [])

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await api.get("/assignments/")
      setAssignments(response.data)
    } catch (error) {
      const status = (error as unknown as { response?: { status?: number } })?.response?.status
      if (status === 401) return
    } catch (error: any) {
      // 401 errors are handled by the API interceptor (logout + redirect)
      if (error.response?.status === 401) {
        return
      }
      console.error("Failed to fetch assignments", error)
    }
  }, [])

  interface ScheduleBlock { id: number; title: string; start_at: string; end_at: string; type?: string; assignment_id?: number; importance_level?: string }
  const fetchScheduleBlocks = useCallback(async () => {
    try {
      const response = await api.get("/schedule/")
      const items = Array.isArray(response.data) ? (response.data as ScheduleBlock[]) : []
      setScheduleBlocks(items.filter((b: ScheduleBlock) => b && (b.type || '').toUpperCase() === 'STUDY'))
    } catch (error) {
      const status = (error as unknown as { response?: { status?: number } })?.response?.status
      if (status === 401) return
      console.error("Failed to fetch schedule", error)
    }
  }, [])

  const fetchCourses = useCallback(async () => {
    try {
      const response = await api.get("/courses/")
      setCourses(response.data || [])
    } catch (error) {
      const status = (error as unknown as { response?: { status?: number } })?.response?.status
      if (status === 401) return
      console.error("Failed to fetch courses", error)
    }
  }, [])

  const fetchUserName = useCallback(async () => {
  const fetchScheduleBlocks = async () => {
    try {
      const response = await api.get("/schedule/", { params: { limit: 1000 } })
      setScheduleBlocks(response.data || [])
    } catch (error: any) {
      // 401 errors are handled by the API interceptor (logout + redirect)
      if (error.response?.status === 401) {
        return
      }
      console.error("Failed to fetch schedule blocks", error)
    }
  }

  const fetchUserName = async () => {
    try {
      const response = await api.get("/users/me")
      if (response.data?.full_name) {
        const firstName = response.data.full_name.split(' ')[0]
        setUserName(firstName)
      }
    } catch {
      // Silently ignore, e.g. on 401
    } catch (error: any) {
      // 401 errors are handled by the API interceptor (logout + redirect)
      if (error.response?.status === 401) {
        return
      }
      console.log("Using default name")
    }
  }, [])

  useEffect(() => {
    let asked = false
    const request = async () => {
      if (typeof window === 'undefined') return
      if (!('Notification' in window)) return
      if (Notification.permission === 'default' && !asked) {
        asked = true
        try { await Notification.requestPermission() } catch {}
      }
    }
    request()
  }, [])

  useEffect(() => {
    const keyName = 'assignwell.notified'
    const readNotified = (): Record<string, boolean> => {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(keyName) : null
        return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      } catch {
        return {}
      }
    }
    const writeNotified = (obj: Record<string, boolean>) => {
      try { if (typeof window !== 'undefined') window.localStorage.setItem(keyName, JSON.stringify(obj)) } catch {}
    }
    const canNotify = () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
    const getList = (): Array<{ id: string; title: string; body: string; ts: number; read: boolean }> => {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('assignwell.notifications') : null
        return raw ? (JSON.parse(raw) as Array<{ id: string; title: string; body: string; ts: number; read: boolean }>) : []
      } catch {
        return []
      }
    }
    const setList = (list: Array<{ id: string; title: string; body: string; ts: number; read: boolean }>) => {
      try { if (typeof window !== 'undefined') window.localStorage.setItem('assignwell.notifications', JSON.stringify(list)) } catch {}
    }
    const fire = (title: string, body: string, idKey: string) => {
      if (canNotify()) new Notification(title, { body })
      const list = getList()
      if (!list.find(n => n.id === idKey)) {
        const item = { id: idKey, title, body, ts: Date.now(), read: false }
        const next = [item, ...list].slice(0, 50)
        setList(next)
        try { window.dispatchEvent(new CustomEvent('assignwell.notification', { detail: item })) } catch {}
      }
    }
    const check = () => {
      const notified = readNotified()
      const now = new Date().getTime()
      const limit = 30 * 60 * 1000
      for (const a of assignments) {
        const dueIso = a.due_at
        if (!dueIso) continue
        const due = new Date(dueIso).getTime()
        const diff = due - now
        if (diff <= 0) continue
        const key = `asg_${a.id}_${dueIso}`
        if (!notified[key] && diff <= limit) {
          fire('Assignment due soon', `${a.title} is due in 30 minutes`, key)
          notified[key] = true
        }
      }
      for (const b of scheduleBlocks) {
        const startIso = b.start_at
        if (!startIso) continue
        const start = new Date(startIso).getTime()
        const diff = start - now
        if (diff <= 0) continue
        const key = `blk_${b.id}_${startIso}`
        if (!notified[key] && diff <= limit) {
          fire('Task starting soon', `${b.title} starts in 30 minutes`, key)
          notified[key] = true
        }
      }
      writeNotified(notified)
    }
    const id = setInterval(check, 60000)
    check()
    return () => clearInterval(id)
  }, [assignments, scheduleBlocks])

  useEffect(() => {
    // Check token on mount and when it changes
    const currentToken = useAuthStore.getState().token
    if (!currentToken) {
      router.replace("/login")
      return
    }

    const id = setTimeout(() => {
      fetchAssignments()
      fetchScheduleBlocks()
      fetchUserName()
      updateGreeting()
      fetchScheduleBlocks()
      fetchCourses()
    }, 0)

    const handleBreakComplete = () => { fetchAssignments(); fetchScheduleBlocks(); fetchCourses() }
    const handleBreakStarted = () => { fetchAssignments(); fetchScheduleBlocks(); fetchCourses() }
    const handleAssignmentUpdated = () => { fetchAssignments(); fetchScheduleBlocks(); fetchCourses() }
    const handleAssignmentAdded = () => { fetchAssignments(); fetchScheduleBlocks(); fetchCourses() }
    const handleBreakComplete = () => {
      fetchAssignments()
      fetchScheduleBlocks()
    }
    const handleBreakStarted = () => {
      fetchAssignments()
      fetchScheduleBlocks()
    }
    const handleAssignmentUpdated = () => {
      fetchAssignments()
      fetchScheduleBlocks()
    }
    const handleAssignmentAdded = () => {
      fetchAssignments()
      fetchScheduleBlocks()
    }
    const handleScheduleUpdated = () => {
      fetchScheduleBlocks()
    }
    window.addEventListener('breakCompleted', handleBreakComplete)
    window.addEventListener('breakStarted', handleBreakStarted)
    window.addEventListener('assignmentUpdated', handleAssignmentUpdated)
    window.addEventListener('assignmentAdded', handleAssignmentAdded)
    window.addEventListener('scheduleUpdated', handleScheduleUpdated)
    return () => {
      window.removeEventListener('breakCompleted', handleBreakComplete)
      window.removeEventListener('breakStarted', handleBreakStarted)
      window.removeEventListener('assignmentUpdated', handleAssignmentUpdated)
      window.removeEventListener('assignmentAdded', handleAssignmentAdded)
      window.removeEventListener('scheduleUpdated', handleScheduleUpdated)
      clearTimeout(id)
    }
  }, [token, router, fetchAssignments, fetchUserName, updateGreeting, fetchScheduleBlocks, fetchCourses])

  return (
    <div className="min-h-screen bg-gray-50 p-6 overflow-hidden">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h2>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {greeting}, {userName}!
        </h1>
        <p className="text-sm text-gray-600">
          Here&apos;s your dashboard for today. Stay focused and take care of yourself.
        </p>
      </div>

      {/* 2x3 Grid Layout */}
      <div className="grid grid-cols-[1fr_1fr_1.3fr] grid-rows-2 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Row 1, Col 1: Calendar */}
        <div className="overflow-hidden">
          <ModernCalendar
            tasks={scheduleBlocks}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onTaskAdded={fetchAssignments}
          />
        </div>

        {/* Row 1, Col 2: Schedule */}
        <div className="overflow-hidden">
          <ScheduleView
            date={selectedDate}
            blocks={scheduleBlocks}
            assignments={assignments}
            tasks={assignments}
            scheduleBlocks={scheduleBlocks}
          />
        </div>

        {/* Row 1, Col 3: Insights */}
        <div className="overflow-hidden h-full">
          <div className="max-w-[100%] ml-auto h-[300px]">
            <InsightsCard tasks={assignments} />
          </div>
        </div>

        {/* Row 2, Col 1: Upcoming Tasks */}
        <div className="overflow-hidden">
          <UpcomingTasks
            tasks={scheduleBlocks}
            selectedDate={selectedDate}
            assignmentsIndex={useMemo(() => Object.fromEntries(assignments.map(a => [a.id, a])), [assignments])}
            subtaskIndex={useMemo(() => {
              const entries: Array<[number, { assignment_id: number; title: string; course_id?: number }]> = []
              for (const a of assignments) {
                for (const s of (a.subtasks || [])) {
                  entries.push([s.id, { assignment_id: a.id, title: a.title, course_id: a.course_id ?? undefined }])
                }
              }
              return Object.fromEntries(entries)
            }, [assignments])}
            coursesIndex={useMemo(() => Object.fromEntries(courses.map(c => [c.id, c])), [courses])}
          />
        </div>

        {/* Row 2, Col 2: Check-In */}
        <div className="overflow-hidden">
          <CheckInCard />
        </div>

        {/* Row 2, Col 3: Activity */}
        <div className="overflow-visible h-[calc(100%+1rem)] -mt-4">
          <ActivitySection />
        </div>
      </div>

      {/* AI Assistant Chatbot */}
      <ChatbotButton />
    </div>
  )
}
