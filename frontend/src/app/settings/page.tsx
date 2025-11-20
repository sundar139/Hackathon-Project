"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"
// import { useAuthStore } from "@/store/auth"

export default function SettingsPage() {
    // const { user, setUser } = useAuthStore()
    const [settings, setSettings] = useState({
        max_daily_study_hours: 8,
        checkin_frequency: "daily",
        theme: "system",
        notifications_enabled: true
    })
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get("/users/me/settings")
                const data = response.data
                setSettings({
                    max_daily_study_hours: data.max_daily_study_hours,
                    checkin_frequency: data.wellbeing_settings?.checkin_frequency || "daily",
                    theme: "system", // Not in backend yet
                    notifications_enabled: data.notification_preferences?.email || false
                })
            } catch (error) {
                console.error("Failed to fetch settings", error)
            }
        }
        fetchSettings()
    }, [])

    const handleSave = async () => {
        setIsLoading(true)
        try {
            const payload = {
                max_daily_study_hours: settings.max_daily_study_hours,
                wellbeing_settings: { checkin_frequency: settings.checkin_frequency },
                notification_preferences: { email: settings.notifications_enabled, push: settings.notifications_enabled }
            }
            await api.put("/users/me/settings", payload)
            setIsLoading(false)
        } catch (error) {
            console.error("Failed to save settings", error)
            setIsLoading(false)
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Study Preferences</CardTitle>
                        <CardDescription>Customize your study schedule and limits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Max Daily Study Hours</Label>
                            <Input
                                type="number"
                                value={settings.max_daily_study_hours}
                                onChange={(e) => setSettings({ ...settings, max_daily_study_hours: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Preferred Study Time</Label>
                            <Select defaultValue="evening">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="morning">Morning (6am - 12pm)</SelectItem>
                                    <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                                    <SelectItem value="evening">Evening (5pm - 10pm)</SelectItem>
                                    <SelectItem value="night">Night (10pm - 2am)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Well-being & Notifications</CardTitle>
                        <CardDescription>Manage how AssignWell interacts with you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="notifications">Enable Notifications</Label>
                            <Switch
                                id="notifications"
                                checked={settings.notifications_enabled}
                                onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Check-in Frequency</Label>
                            <Select
                                value={settings.checkin_frequency}
                                onValueChange={(val) => setSettings({ ...settings, checkin_frequency: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="never">Never</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <div className="col-span-4">
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
