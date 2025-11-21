"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"

interface ScheduleBlock {
  id: number
  start_at: string
  end_at: string
  status: "PLANNED" | "COMPLETED" | "SKIPPED" | "CANCELED"
}

interface Goal {
  id: number
  name: string
  duration_minutes: number
}

interface GoalSession {
  id: number
  goal_id: number
  start_time: string
  end_time: string
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "SKIPPED"
}

interface Group {
  id: number
  name: string
  description: string
  is_member?: boolean
}

interface Pair {
  id: number
  user_a_id: number
  user_b_id: number
  weekly_checkins: number
  active: boolean
}

interface PartnerSuggestion {
  user_id: number
  full_name?: string
  timezone?: string
  score: number
}

export default function AccountabilityPage() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [sessionsMap, setSessionsMap] = useState<Record<number, GoalSession[]>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [suggestions, setSuggestions] = useState<PartnerSuggestion[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sRes = await api.get("/schedule/")
        setBlocks(sRes.data || [])
      } catch {}
      try {
        const gRes = await api.get("/goals/")
        setGoals(gRes.data || [])
        const map: Record<number, GoalSession[]> = {}
        for (const g of gRes.data || []) {
          try {
            const sesRes = await api.get(`/goals/${g.id}/sessions`)
            map[g.id] = sesRes.data || []
          } catch {
            map[g.id] = []
          }
        }
        setSessionsMap(map)
      } catch {}
      try {
        const pgRes = await api.get("/peer-groups/")
        setGroups((pgRes.data || []).filter((x: Group) => x.is_member))
      } catch {}
      try {
        const pRes = await api.get("/accountability/pairs")
        setPairs(pRes.data || [])
        const sRes = await api.get("/accountability/suggest-partners")
        setSuggestions(sRes.data || [])
      } catch {}
    }
    fetchData()
  }, [])

  const [nowDate] = useState<Date>(() => new Date())
  const [weekAgoDate] = useState<Date>(() => new Date(Date.now() - 7 * 24 * 3600 * 1000))

  const weeklyBlocks = useMemo(() => {
    if (!nowDate || !weekAgoDate) return []
    return blocks.filter(b => {
      const start = new Date(b.start_at)
      return start >= weekAgoDate && start <= nowDate
    })
  }, [blocks, weekAgoDate, nowDate])

  const completionRate = useMemo(() => {
    const total = weeklyBlocks.length
    const completed = weeklyBlocks.filter(b => b.status === "COMPLETED").length
    return total === 0 ? 0 : Math.round((completed / total) * 100)
  }, [weeklyBlocks])

  const selectedGoalSessions = useMemo(() => {
    if (!selectedGoalId || !nowDate || !weekAgoDate) return []
    return (sessionsMap[selectedGoalId] || []).filter(s => {
      const start = new Date(s.start_time)
      return start >= weekAgoDate && start <= nowDate
    })
  }, [selectedGoalId, sessionsMap, weekAgoDate, nowDate])

  const goalCompletion = useMemo(() => {
    const sessions = selectedGoalSessions
    const total = sessions.length
    const completed = sessions.filter(s => s.status === "COMPLETED").length
    return total === 0 ? 0 : Math.round((completed / total) * 100)
  }, [selectedGoalSessions])

  const handleNudge = async (groupId: number) => {
    try {
      await api.post(`/peer-groups/${groupId}/nudge`)
    } catch {}
  }

  const handlePairNudge = async (pairId: number) => {
    try {
      await api.post(`/accountability/pairs/${pairId}/nudge`, { content: "Keep going! You’ve got this." })
    } catch {}
  }

  const handleCreatePair = async (userId: number) => {
    try {
      await api.post(`/accountability/pairs`, { user_b_id: userId, weekly_checkins: 1 })
      const pRes = await api.get("/accountability/pairs")
      setPairs(pRes.data || [])
    } catch {}
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Accountability Dashboard</h2>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Completion</CardTitle>
          <CardDescription>Past 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{completionRate}%</div>
          <div className="text-sm text-muted-foreground">Completed vs total planned blocks</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Goals</CardTitle>
          <CardDescription>Select a goal to see progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select onValueChange={(v) => setSelectedGoalId(Number(v))}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Choose a goal" />
              </SelectTrigger>
              <SelectContent>
                {goals.map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGoalId && (
              <div className="text-xl font-semibold">{goalCompletion}%</div>
            )}
          </div>
          {selectedGoalId && (
            <div className="mt-2 text-sm text-muted-foreground">Completed sessions in the past week</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Nudge</CardTitle>
          <CardDescription>Encourage your groups</CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-sm text-muted-foreground">Join a group to send nudges</div>
          ) : (
            <ul className="space-y-2">
              {groups.map(g => (
                <li key={g.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.description}</div>
                  </div>
                  <Button onClick={() => handleNudge(g.id)}>Nudge</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accountability Partners</CardTitle>
          <CardDescription>Your pairs and suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          {pairs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No partners yet</div>
          ) : (
            <ul className="space-y-2 mb-4">
              {pairs.map(p => (
                <li key={p.id} className="flex items-center justify-between">
                  <div className="text-sm">Pair #{p.id} — weekly check-ins: {p.weekly_checkins}</div>
                  <Button onClick={() => handlePairNudge(p.id)}>Nudge</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="font-medium mb-2">Suggestions</div>
          {suggestions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No suggestions at the moment</div>
          ) : (
            <ul className="space-y-2">
              {suggestions.map(s => (
                <li key={s.user_id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.full_name || `User #${s.user_id}`}</div>
                    <div className="text-xs text-muted-foreground">Timezone: {s.timezone} • Score: {s.score}</div>
                  </div>
                  <Button onClick={() => handleCreatePair(s.user_id)}>Pair</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}