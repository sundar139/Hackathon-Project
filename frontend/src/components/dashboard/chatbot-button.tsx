"use client"

import { useState } from "react"
import { MessageCircle, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import api from "@/lib/api"

interface Message {
    role: "user" | "assistant"
    content: string
}

export function ChatbotButton() {
    const [isOpen, setIsOpen] = useState(false)
    const initialMessage: Message = { role: "assistant", content: "I’m here with you. What’s been weighing on you lately?" }
    const [messages, setMessages] = useState<Message[]>([initialMessage])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const endActiveSession = async () => {
        try {
            const sessionsRes = await api.get("/chat/sessions")
            const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data as Array<{ id: number; ended_at?: string | null }> : []
            const active = sessions.find(s => !s.ended_at)
            if (active) {
                await api.post(`/chat/sessions/${active.id}/end`)
            }
        } catch {}
    }

    const handleClose = async () => {
        setIsOpen(false)
        setMessages([initialMessage])
        setInput("")
        await endActiveSession()
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = { role: "user", content: input }
        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        try {
            const response = await api.post("/chat/ask", { role: "user", content: input })
            const aiMessage: Message = { role: "assistant", content: response.data.content }
            setMessages(prev => [...prev, aiMessage])
        } catch (error) {
            console.error("Chat error:", error)
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now." }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            {/* Chatbot Popup */}
            {isOpen && (
                <div className="fixed bottom-24 right-8 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300 z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <MessageCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="font-semibold">AssignWell Companion</h3>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4 overflow-y-auto">
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex gap-2",
                                        message.role === "user" && "flex-row-reverse"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                        message.role === "assistant" ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-600"
                                    )}>
                                        {message.role === "assistant" ? "🤖" : "👤"}
                                    </div>
                                    <div className={cn(
                                        "max-w-[70%] rounded-2xl px-4 py-2",
                                        message.role === "assistant" ? "bg-gray-100 text-gray-900" : "bg-rose-500 text-white"
                                    )}>
                                        <p className="text-sm">{message.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">🤖</div>
                                    <div className="bg-gray-100 rounded-2xl px-4 py-2">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4 border-t">
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Type a message..."
                                className="flex-1"
                                disabled={isLoading}
                            />
                            <Button aria-label="Send" onClick={handleSend} disabled={!input.trim() || isLoading} className="bg-rose-500 hover:bg-rose-600">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={async () => {
                    if (isOpen) {
                        await handleClose()
                    } else {
                        setIsOpen(true)
                        setMessages([initialMessage])
                        setInput("")
                    }
                }}
                className="fixed bottom-8 right-8 w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
                aria-label="Message Square"
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>

            {/* Click-away overlay */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/20 z-40" onClick={handleClose} />
            )}
        </>
    )
}
