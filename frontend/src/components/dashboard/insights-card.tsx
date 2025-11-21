"use client"

import { useEffect, useMemo, useState } from "react"

interface Assignment {
    id: number
    title: string
    due_at: string
    importance_level: string
    status?: string
}

export function InsightsCard({ tasks }: { tasks: Assignment[] }) {
    const [loginAt] = useState<number>(() => {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("loginAt") : null
        return stored ? parseInt(stored) : Date.now()
    })
    const [elapsedMs, setElapsedMs] = useState<number>(0)
    const [overrides, setOverrides] = useState<Record<number, string>>({})

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedMs(Date.now() - loginAt)
        }, 1000)
        return () => clearInterval(interval)
    }, [loginAt])

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { id?: number; status?: string } | undefined
            if (detail?.id) {
                setOverrides(prev => ({ ...prev, [detail.id!]: detail.status || "COMPLETED" }))
            }
        }
        window.addEventListener("assignmentUpdated", handler as EventListener)
        return () => window.removeEventListener("assignmentUpdated", handler as EventListener)
    }, [])

    const isSameDay = (d: Date, e: Date) => d.toDateString() === e.toDateString()

    const { completionPct } = useMemo(() => {
        const now = new Date()
        const todays = tasks.filter(t => {
            const dt = new Date(t.due_at)
            return isSameDay(dt, now)
        })
        const total = todays.length
        const completed = todays.filter(t => {
            const ov = overrides[t.id]
            const s = (ov ?? t.status ?? "").toLowerCase()
            return s === "completed"
        }).length
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
        return { completionPct: pct }
    }, [tasks, overrides])

    const focusHours = Math.floor(elapsedMs / 3600000)
    const focusMinutes = Math.floor((elapsedMs % 3600000) / 60000)
    const focusPct = Math.min(100, Math.round((elapsedMs / (8 * 3600000)) * 100))

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm h-full flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Insights</h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Task Completion</p>
                    <p className="text-2xl font-bold text-green-600">{completionPct}%</p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${completionPct}%` }}></div>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Focus Time</p>
                    <p className="text-2xl font-bold text-blue-600">{focusHours}<span className="text-sm"> hrs</span>{focusMinutes > 0 ? ` ${focusMinutes}m` : ""}</p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${focusPct}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Mood Correlation</p>
                <div className="flex items-center gap-2">
                    <span className="text-green-600">📈</span>
                    <p className="text-xs text-gray-700">Productivity is higher on sunny days.</p>
                </div>
            </div>
        </div>
    )
}
