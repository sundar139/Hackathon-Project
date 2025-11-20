"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import api from "@/lib/api"

export function AddTaskDialog({ onTaskAdded, children }: { onTaskAdded?: () => void, children?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [newTask, setNewTask] = useState({
        title: "",
        due_date: "",
        priority: "medium",
        estimated_minutes: 30,
    })
    const { toast } = useToast()

    const handleCreateTask = async () => {
        if (!newTask.title || !newTask.due_date) {
            toast({
                title: "Missing Information",
                description: "Please fill in task name and deadline",
                variant: "destructive"
            })
            return
        }

        if (!Number.isFinite(newTask.estimated_minutes) || newTask.estimated_minutes <= 0) {
            toast({
                title: "Invalid Estimated Minutes",
                description: "Please enter a positive number of minutes",
                variant: "destructive"
            })
            return
        }

        try {
            const dueIso = (() => {
                if (!newTask.due_date) return undefined
                const d = new Date(newTask.due_date)
                const tz = d.getTimezoneOffset()
                const sign = tz <= 0 ? "+" : "-"
                const abs = Math.abs(tz)
                const offH = String(Math.floor(abs / 60)).padStart(2, "0")
                const offM = String(abs % 60).padStart(2, "0")
                const pad = (n: number) => String(n).padStart(2, "0")
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offH}:${offM}`
            })()
            const payload = {
                title: newTask.title,
                due_at: dueIso,
                importance_level: newTask.priority,
                status: "NOT_STARTED",
                estimated_minutes: newTask.estimated_minutes,
            }
            await api.post("/assignments/", payload)

            toast({
                title: "Task Added!",
                description: `${newTask.title} has been added to your calendar`
            })

            setOpen(false)
            setNewTask({
                title: "",
                due_date: "",
                priority: "medium",
                estimated_minutes: 30,
            })
            if (onTaskAdded) onTaskAdded()
        } catch (error) {
            console.error("Failed to create task", error)
            const resp = (error as { response?: { data?: unknown; status?: number } })?.response
            if (resp) {
                console.error("Error response:", resp.data)
                console.error("Error status:", resp.status)
            }
            let desc = "Failed to add task. Please try again."
            const data = resp?.data as unknown
            let detail: unknown = undefined
            if (data && typeof data === "object" && "detail" in (data as Record<string, unknown>)) {
                detail = (data as Record<string, unknown>).detail
            }
            if (Array.isArray(detail)) {
                desc = detail
                    .map((d: Record<string, unknown>) =>
                        typeof d.msg === "string" ? d.msg : JSON.stringify(d)
                    )
                    .join("; ")
            } else if (typeof detail === "string") {
                desc = detail
            }
            toast({
                title: "Error",
                description: desc,
                variant: "destructive"
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button size="sm" className="h-8">
                        <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Task</DialogTitle>
                    <DialogDescription>
                        Create a task to stay organized.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            className="col-span-3"
                            placeholder="e.g., Read Chapter 4"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="due" className="text-right">
                            Due Date
                        </Label>
                        <Input
                            id="due"
                            type="datetime-local"
                            value={newTask.due_date}
                            onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="priority" className="text-right">
                            Priority
                        </Label>
                        <Select
                            value={newTask.priority}
                            onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="est" className="text-right">
                            Est. Min
                        </Label>
                        <Input
                            id="est"
                            type="number"
                            value={newTask.estimated_minutes}
                            onChange={(e) => setNewTask({ ...newTask, estimated_minutes: parseInt(e.target.value) })}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreateTask}>Save Task</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
