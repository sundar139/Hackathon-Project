"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts"
import { Activity } from "lucide-react"
import api from "@/lib/api"

// Dummy data for activity (still static for now)
const activityData = [
    { name: "Study", hours: 5 },
    { name: "Sleep", hours: 7 },
    { name: "Social", hours: 3 },
    { name: "Exercise", hours: 1 },
]

export default function WellBeingPage() {
  const [checkin, setCheckin] = useState({
        mood_valence: "neutral",
        energy_level: 3,
        stress_level: 5,
        anxiety_level: 5,
        sleep_hours_last_night: 7,
        note: ""
    })
    const [moodHistory, setMoodHistory] = useState<{ date: string; score: number; energy: number; stress: number; fullDate: string }[]>([])
    const [aiInsight, setAiInsight] = useState("")

  const fetchMoodHistory = async () => {
    try {
      const response = await api.get("/mood/")
      // Transform data for chart - mapping valence to score for visualization
            const valenceMap: Record<string, number> = {
                "very_negative": 1,
                "negative": 2,
                "neutral": 3,
                "positive": 4,
                "very_positive": 5
            }

            type MoodLog = { created_at: string; mood_valence: string; energy_level: number; stress_level: number }
            const logs = response.data as MoodLog[]
            const formattedData = logs.map((log) => ({
                date: new Date(log.created_at).toLocaleDateString('en-US', { weekday: 'short' }),
                score: valenceMap[log.mood_valence] || 3,
                energy: log.energy_level,
                stress: log.stress_level,
                fullDate: log.created_at
            })).reverse().slice(0, 7).reverse()
            setMoodHistory(formattedData)
        } catch (error) {
      console.error("Failed to fetch mood history", error)
    }
  }

  const fetchAiInsight = async () => {
    try {
      const response = await api.post("/mood/analyze")
      setAiInsight(response.data.insight)
        } catch (error) {
      console.error("Failed to fetch AI insight", error)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      fetchMoodHistory()
      fetchAiInsight()
    }, 0)
    return () => clearTimeout(id)
  }, [])

    const handleCheckIn = async () => {
        try {
            const payload = {
                mood_valence: checkin.mood_valence,
                energy_level: Number(checkin.energy_level),
                stress_level: Number(checkin.stress_level),
                anxiety_level: Number(checkin.anxiety_level),
                sleep_hours_last_night: Number(checkin.sleep_hours_last_night) || 0,
                note: checkin.note
            }
            await api.post("/mood/", payload)
            setCheckin({
                mood_valence: "neutral",
                energy_level: 3,
                stress_level: 5,
                anxiety_level: 5,
                sleep_hours_last_night: 7,
                note: ""
            })
            fetchMoodHistory()
            fetchAiInsight()
        } catch (error) {
            console.error("Failed to save check-in", error)
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Well-Being Center</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Mood Check-in Column */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Daily Check-in</CardTitle>
                        <CardDescription>How are you feeling today?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Mood Valence</Label>
                                <Select
                                    value={checkin.mood_valence}
                                    onValueChange={(val) => setCheckin({ ...checkin, mood_valence: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select mood" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="very_positive">Very Positive</SelectItem>
                                        <SelectItem value="positive">Positive</SelectItem>
                                        <SelectItem value="neutral">Neutral</SelectItem>
                                        <SelectItem value="negative">Negative</SelectItem>
                                        <SelectItem value="very_negative">Very Negative</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Energy Level (1-5)</Label>
                                    <span className="text-sm text-muted-foreground">{checkin.energy_level}</span>
                                </div>
                                <Slider
                                    value={[checkin.energy_level]}
                                    onValueChange={(val) => setCheckin({ ...checkin, energy_level: val[0] })}
                                    max={5}
                                    min={1}
                                    step={1}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Stress Level (0-10)</Label>
                                    <span className="text-sm text-muted-foreground">{checkin.stress_level}</span>
                                </div>
                                <Slider
                                    value={[checkin.stress_level]}
                                    onValueChange={(val) => setCheckin({ ...checkin, stress_level: val[0] })}
                                    max={10}
                                    min={0}
                                    step={1}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Sleep Hours</Label>
                                <Input
                                    type="number"
                                    value={checkin.sleep_hours_last_night}
                                    onChange={(e) => setCheckin({ ...checkin, sleep_hours_last_night: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="note">Journal Note (Optional)</Label>
                            <Textarea
                                id="note"
                                placeholder="What's on your mind?"
                                value={checkin.note}
                                onChange={(e) => setCheckin({ ...checkin, note: e.target.value })}
                            />
                        </div>

                        <Button className="w-full" onClick={handleCheckIn}>
                            Save Check-in
                        </Button>
                    </CardContent>
                </Card>

                {/* Insights Column */}
                <div className="col-span-4 space-y-4">
                    {/* AI Insight Card */}
                    <Card className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                        <CardHeader className="pb-2">
                            <div className="flex items-center space-x-2">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                <CardTitle className="text-lg text-indigo-700 dark:text-indigo-300">AI Wellness Insight</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {aiInsight || "Log your mood to get personalized insights!"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Mood Trends</CardTitle>
                            <CardDescription>Your emotional well-being over the last 7 entries.</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={moodHistory}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis domain={[0, 5]} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#8884d8"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                            name="Mood"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="energy"
                                            stroke="#82ca9d"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            name="Energy"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Activity Balance</CardTitle>
                            <CardDescription>Where your time went this week.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activityData}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip />
                                        <Bar dataKey="hours" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
