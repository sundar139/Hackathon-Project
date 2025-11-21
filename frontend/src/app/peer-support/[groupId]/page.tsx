"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/api"

interface Group {
  id: number
  name: string
  description: string
  member_count?: number
  is_member?: boolean
}

interface Member {
  id: number
  user_id: number
  group_id: number
  joined_at: string
}

interface Message {
  id: number
  group_id: number
  user_id: number
  content: string
  created_at: string
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = Number(params?.groupId)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!groupId || Number.isNaN(groupId)) return
    const fetchAll = async () => {
      try {
        const gRes = await api.get(`/peer-groups/${groupId}`)
        setGroup(gRes.data)
        if (gRes.data.is_member) {
          const mRes = await api.get(`/peer-groups/${groupId}/members`)
          setMembers(mRes.data || [])
          const msgRes = await api.get(`/peer-groups/${groupId}/messages`)
          setMessages(msgRes.data || [])
        } else {
          setMembers([])
          setMessages([])
        }
      } catch {
        setGroup(null)
      }
    }
    fetchAll()
  }, [groupId])

  const handleJoin = async () => {
    if (!groupId) return
    try {
      await api.post(`/peer-groups/${groupId}/join`)
      const gRes = await api.get(`/peer-groups/${groupId}`)
      setGroup(gRes.data)
      const mRes = await api.get(`/peer-groups/${groupId}/members`)
      setMembers(mRes.data || [])
      const msgRes = await api.get(`/peer-groups/${groupId}/messages`)
      setMessages(msgRes.data || [])
    } catch {}
  }

  const handleLeave = async () => {
    if (!groupId) return
    try {
      await api.delete(`/peer-groups/${groupId}/leave`)
      const gRes = await api.get(`/peer-groups/${groupId}`)
      setGroup(gRes.data)
      setMembers([])
      setMessages([])
    } catch {}
  }

  const handlePost = async () => {
    if (!messageText.trim() || !groupId) return
    setLoading(true)
    try {
      const res = await api.post(`/peer-groups/${groupId}/messages`, { content: messageText })
      setMessages(prev => [res.data, ...prev])
      setMessageText("")
    } catch {}
    setLoading(false)
  }

  if (!group) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Button variant="ghost" onClick={() => router.push("/peer-support")}>Back</Button>
        <Card>
          <CardHeader>
            <CardTitle>Group not found</CardTitle>
            <CardDescription>Return to Peer Support</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <Button variant="ghost" onClick={() => router.push("/peer-support")}>Back</Button>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Members: {group.member_count || 0}</div>
              {group.is_member ? (
                <Button variant="outline" onClick={handleLeave}>Leave</Button>
              ) : (
                <Button onClick={handleJoin}>Join</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {group.is_member ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Write a message" value={messageText} onChange={e => setMessageText(e.target.value)} />
                  <Button onClick={handlePost} disabled={loading}>Send</Button>
                </div>
                <ScrollArea className="h-[400px] border rounded-md p-3">
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No messages yet</div>
                    ) : (
                      messages.map(m => (
                        <div key={m.id} className="border rounded-md p-3">
                          <div className="text-sm">{m.content}</div>
                          <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <div className="font-medium mb-2">Members</div>
                <ul className="space-y-2">
                  {members.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No members yet</li>
                  ) : (
                    members.map(m => (
                      <li key={m.id} className="text-sm">User #{m.user_id}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Join the group to view messages and members</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}