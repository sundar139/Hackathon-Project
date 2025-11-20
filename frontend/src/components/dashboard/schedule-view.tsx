"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface Assignment {
    id: number
    title: string
    due_at: string
    estimated_minutes?: number
    importance_level: string
}

interface ScheduleViewProps {
    date: Date
    tasks: Assignment[]
}

export function ScheduleView({ date, tasks }: ScheduleViewProps) {
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const tasksForDate = tasks.filter(task => {
        const taskDate = new Date(task.due_at)
        return taskDate.toDateString() === date.toDateString()
    })

    const getTaskPosition = (task: Assignment) => {
        const taskDate = new Date(task.due_at)
        const hour = taskDate.getHours()
        const minutes = taskDate.getMinutes()
        return hour + minutes / 60
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
                            <div className="w-16 flex-shrink-0 text-xs text-gray-500 pr-2 pt-1">
                                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                            </div>
                            <div className="flex-1 relative">
                                {tasksForDate
                                    .filter(task => Math.floor(getTaskPosition(task)) === hour)
                                    .map((task) => (
                                        <div
                                            key={task.id}
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
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                {tasksForDate.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400 text-sm">No tasks scheduled</p>
                    </div>
                )}
            </div>
        </div>
    )
}
