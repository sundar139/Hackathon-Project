"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
}

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([])
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
    

    const fetchAssignments = async () => {
        try {
            const response = await api.get("/assignments/")
            setAssignments(response.data)
        } catch (error) {
            console.error("Failed to fetch assignments", error)
        }
    }

    useEffect(() => {
        const id = setTimeout(() => {
            fetchAssignments()
        }, 0)
        return () => clearTimeout(id)
    }, [])

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
                                {/* Course selection would go here, need to fetch courses first */}
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
                                        value={newAssignment.user_confidence}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, user_confidence: parseInt(e.target.value) })}
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
                                <Input placeholder="Search assignments..." className="pl-8 w-[250px]" />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Importance</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assignments.filter(a => !a.title?.toLowerCase().includes('break')).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">No assignments found.</TableCell>
                                </TableRow>
                            ) : (
                                assignments.filter(a => !a.title?.toLowerCase().includes('break')).map((assignment) => (
                                    <TableRow key={assignment.id}>
                                        <TableCell className="font-medium">{assignment.title}</TableCell>
                                        <TableCell>{assignment.course_id || "N/A"}</TableCell>
                                        <TableCell>{new Date(assignment.due_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                assignment.importance_level === "high" || assignment.importance_level === "critical" ? "destructive" :
                                                    assignment.importance_level === "medium" ? "default" : "secondary"
                                            }>
                                                {assignment.importance_level}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{assignment.status}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm">Edit</Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGeneratePlan(assignment.id)}
                                            >
                                                Generate Plan
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
