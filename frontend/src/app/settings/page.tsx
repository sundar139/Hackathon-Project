"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import api from "@/lib/api"
// import { useAuthStore } from "@/store/auth"

export default function SettingsPage() {
    // const { user, setUser } = useAuthStore()
    const [settings, setSettings] = useState({
        max_daily_study_hours: 8,
        checkin_frequency: "daily",
        theme: "system",
        notifications_enabled: true,
        notifications_task_reminders: true,
        notifications_assignment_deadlines: true,
        default_priority: "medium",
        allow_recurring_tasks: true
    })
    const [calendars, setCalendars] = useState({ google_connected: false, outlook_connected: false })
    const [accountDangerOpen, setAccountDangerOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [breakTitlesText, setBreakTitlesText] = useState<string>(() => {
        try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem('assignwell.excludedBreakTitles') : null
            if (raw) {
                const parsed = (() => { try { return JSON.parse(raw) as string[] } catch { return [] } })()
                if (Array.isArray(parsed) && parsed.length) return parsed.join(", ")
            }
        } catch {}
        return "Quick Break"
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get("/users/me/settings")
                const data = response.data
                setSettings({
                    max_daily_study_hours: data.max_daily_study_hours,
                    checkin_frequency: data.wellbeing_settings?.checkin_frequency || "daily",
                    theme: "system", // Not in backend yet
                    notifications_enabled: data.notification_preferences?.email || false,
                    notifications_task_reminders: true,
                    notifications_assignment_deadlines: true,
                    default_priority: "medium",
                    allow_recurring_tasks: true
                })
                try {
                    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('assignwell.calendar.connections') : null
                    const saved = raw ? JSON.parse(raw) as { google_connected: boolean; outlook_connected: boolean } : { google_connected: false, outlook_connected: false }
                    setCalendars(saved)
                } catch {}
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
                notification_preferences: {
                    email: settings.notifications_enabled,
                    push: settings.notifications_enabled,
                    task_reminders: settings.notifications_task_reminders,
                    assignment_deadlines: settings.notifications_assignment_deadlines,
                },
                privacy_preferences: {
                    calendar_connections: {
                        google_connected: calendars.google_connected,
                        outlook_connected: calendars.outlook_connected,
                    },
                    task_goal_preferences: {
                        default_priority: settings.default_priority,
                        allow_recurring_tasks: settings.allow_recurring_tasks,
                    }
                }
            }
            await api.put("/users/me/settings", payload)
            setIsLoading(false)
        } catch (error) {
            console.error("Failed to save settings", error)
            setIsLoading(false)
        }
    }

    const handleSaveLocal = () => {
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('assignwell.calendar.connections', JSON.stringify(calendars))
                window.localStorage.setItem('assignwell.preferences', JSON.stringify({
                    notifications_task_reminders: settings.notifications_task_reminders,
                    notifications_assignment_deadlines: settings.notifications_assignment_deadlines,
                    default_priority: settings.default_priority,
                    allow_recurring_tasks: settings.allow_recurring_tasks,
                }))
            }
        } catch {}
    }

    const handleSaveBreakFilters = () => {
        const items = breakTitlesText
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
        try {
            window.localStorage.setItem('assignwell.excludedBreakTitles', JSON.stringify(items))
        } catch {}
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
                                value={Number.isFinite(settings.max_daily_study_hours) ? settings.max_daily_study_hours : 0}
                                onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10)
                                    setSettings({ ...settings, max_daily_study_hours: Number.isFinite(parsed) ? parsed : 0 })
                                }}
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
                        <div className="space-y-2">
                            <Label>Default Task Priority</Label>
                            <Select value={settings.default_priority} onValueChange={(val) => setSettings({ ...settings, default_priority: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="recurring">Allow Recurring Tasks</Label>
                            <Switch id="recurring" checked={settings.allow_recurring_tasks} onCheckedChange={(checked) => setSettings({ ...settings, allow_recurring_tasks: checked })} />
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
                        <div className="flex items-center justify-between space-x-2">
                            <Label>Task Reminders</Label>
                            <Switch checked={settings.notifications_task_reminders} onCheckedChange={(checked) => setSettings({ ...settings, notifications_task_reminders: checked })} />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label>Assignment Deadline Alerts</Label>
                            <Switch checked={settings.notifications_assignment_deadlines} onCheckedChange={(checked) => setSettings({ ...settings, notifications_assignment_deadlines: checked })} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Connected Calendars</CardTitle>
                        <CardDescription>Integrate with external calendars</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">Google Calendar</div>
                                <div className="text-xs text-muted-foreground">Sync assignments and goals</div>
                            </div>
                            <Button variant={calendars.google_connected ? "outline" : undefined} onClick={() => setCalendars({ ...calendars, google_connected: !calendars.google_connected })}>
                                {calendars.google_connected ? "Disconnect" : "Connect"}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">Outlook Calendar</div>
                                <div className="text-xs text-muted-foreground">Sync assignments and goals</div>
                            </div>
                            <Button variant={calendars.outlook_connected ? "outline" : undefined} onClick={() => setCalendars({ ...calendars, outlook_connected: !calendars.outlook_connected })}>
                                {calendars.outlook_connected ? "Disconnect" : "Connect"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Break Filters</CardTitle>
                        <CardDescription>Set break titles to exclude from Upcoming Tasks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Excluded Break Titles (comma-separated)</Label>
                            <Input
                                value={breakTitlesText}
                                onChange={(e) => setBreakTitlesText(e.target.value)}
                                placeholder="Quick Break, Nap, Lunch Break"
                            />
                        </div>
                        <Button variant="outline" onClick={handleSaveBreakFilters}>Save Break Filters</Button>
                    </CardContent>
                </Card>

                <div className="col-span-4 flex items-center gap-3">
                    <Button onClick={() => { handleSave(); handleSaveLocal(); }} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="destructive" onClick={() => setAccountDangerOpen(true)}>Deactivate/Delete Account</Button>
                </div>
            </div>
            <Dialog open={accountDangerOpen} onOpenChange={setAccountDangerOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Account Actions</DialogTitle>
                        <DialogDescription>Deactivate or delete your account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="text-sm">Deactivation temporarily disables your account without deleting data.</div>
                        <div className="text-sm">Deletion removes your account and data.</div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAccountDangerOpen(false)}>Cancel</Button>
                        <Button variant="secondary" onClick={async () => { try { await api.post('/users/me/deactivate') } catch {}; setAccountDangerOpen(false) }}>Deactivate</Button>
                        <Button variant="destructive" onClick={async () => { try { await api.delete('/users/me') } catch {}; setAccountDangerOpen(false); try { if (typeof window !== 'undefined') { window.localStorage.removeItem('auth-storage'); } } catch {}; location.assign('/login') }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
