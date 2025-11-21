"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { ModernCalendar } from "@/components/dashboard/modern-calendar"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { QuickBreaks } from "@/components/dashboard/quick-breaks"
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
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()) // Today by default
  const [userName, setUserName] = useState("Student")
  const [greeting, setGreeting] = useState("Good Morning")

  const updateGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good Morning")
    else if (hour < 18) setGreeting("Good Afternoon")
    else setGreeting("Good Evening")
  }

  const fetchAssignments = async () => {
    try {
      const response = await api.get("/assignments/")
      setAssignments(response.data)
    } catch (error: any) {
      // 401 errors are handled by the API interceptor (logout + redirect)
      if (error.response?.status === 401) {
        return
      }
      console.error("Failed to fetch assignments", error)
    }
  }

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
    } catch (error: any) {
      // 401 errors are handled by the API interceptor (logout + redirect)
      if (error.response?.status === 401) {
        return
      }
      console.log("Using default name")
    }
  }

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
    }, 0)

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
  }, [token, router])

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
      <div className="grid grid-cols-3 grid-rows-2 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Row 1, Col 1: Calendar */}
        <div className="overflow-hidden">
          <ModernCalendar
            tasks={assignments}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onTaskAdded={fetchAssignments}
          />
        </div>

        {/* Row 1, Col 2: Schedule */}
        <div className="overflow-hidden">
          <ScheduleView
            date={selectedDate}
            tasks={assignments}
            scheduleBlocks={scheduleBlocks}
          />
        </div>

        {/* Row 1, Col 3: Insights */}
        <div className="overflow-hidden">
          <InsightsCard tasks={assignments} />
        </div>

        {/* Row 2, Col 1: Upcoming Tasks */}
        <div className="overflow-hidden">
          <UpcomingTasks tasks={assignments} selectedDate={selectedDate} />
        </div>

        {/* Row 2, Col 2: Check-In */}
        <div className="overflow-hidden">
          <CheckInCard />
        </div>

        {/* Row 2, Col 3: Quick Breaks */}
        <div className="overflow-hidden">
          <QuickBreaks />
        </div>
      </div>

      {/* AI Assistant Chatbot */}
      <ChatbotButton />
    </div>
  )
}
