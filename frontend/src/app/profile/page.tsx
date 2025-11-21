"use client"

import { useMemo, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function ProfilePage() {
  const storeUser = useAuthStore(state => state.user)
  const setUser = useAuthStore(state => state.setUser)
  const [profile, setProfile] = useState(() => {
    const base = {
      full_name: storeUser?.full_name || "",
      email: storeUser?.email || "",
      school: "",
      academic_year: "",
      major: "",
      contact_number: "",
      photo_url: "",
    }
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("assignwell.profile.extra") : null
      type ProfileExtra = { school?: string; academic_year?: string; major?: string; contact_number?: string; photo_url?: string }
      const saved = raw ? (JSON.parse(raw) as ProfileExtra) : {}
      return { ...base, ...saved }
    } catch {
      return base
    }
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [openPassword, setOpenPassword] = useState(false)
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" })

  

  const photoPreview = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile)
    if (profile.photo_url) return profile.photo_url
    return ""
  }, [photoFile, profile.photo_url])

  const handleSave = async () => {
    try {
      // Update core profile (name, email, institution)
      const core = {
        full_name: profile.full_name,
        email: profile.email,
        institution: profile.school,
      }
      const res = await api.put("/users/me", core)
      if (res?.data) {
        setUser({ id: res.data.id, email: res.data.email, full_name: res.data.full_name })
      }
      // Update extended details under settings
      await api.put("/users/me/profile-details", {
        academic_year: profile.academic_year,
        major: profile.major,
        contact_number: profile.contact_number,
        photo_url: profile.photo_url,
      })
      // Persist locally for convenience
      const extra = {
        school: profile.school,
        academic_year: profile.academic_year,
        major: profile.major,
        contact_number: profile.contact_number,
        photo_url: profile.photo_url,
      }
      if (typeof window !== "undefined") window.localStorage.setItem("assignwell.profile.extra", JSON.stringify(extra))
    } catch {}
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Manage personal information and identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>School/Institution</Label>
              <Input value={profile.school} onChange={e => setProfile({ ...profile, school: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Grade Level / Academic Year</Label>
              <Input value={profile.academic_year} onChange={e => setProfile({ ...profile, academic_year: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Major / Program</Label>
              <Input value={profile.major} onChange={e => setProfile({ ...profile, major: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact Number (optional)</Label>
              <Input value={profile.contact_number} onChange={e => setProfile({ ...profile, contact_number: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 items-end">
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <Input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
              {photoPreview && (
                <img src={photoPreview} alt="Profile" className="h-24 w-24 rounded-full object-cover" />
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpenPassword(true)}>Change Password</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openPassword} onOpenChange={setOpenPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update your account password</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={passwords.next} onChange={e => setPasswords({ ...passwords, next: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPassword(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!passwords.next || passwords.next !== passwords.confirm) { setOpenPassword(false); return }
              try {
                await api.post("/users/me/change-password", { current_password: passwords.current, new_password: passwords.next })
              } catch {}
              setOpenPassword(false)
              setPasswords({ current: "", next: "", confirm: "" })
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
import api from "@/lib/api"