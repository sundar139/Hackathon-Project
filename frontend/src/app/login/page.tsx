
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/auth"
import api from "@/lib/api"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [rememberMe, setRememberMe] = useState(true)
    const [savePassword, setSavePassword] = useState(false)
    const router = useRouter()
    const { setToken, setUser } = useAuthStore()

    useEffect(() => {
        try {
            const savedEmail = window.localStorage.getItem("auth.rememberEmail")
            const savedRemember = window.localStorage.getItem("auth.rememberMe")
            if (savedEmail) setEmail(savedEmail)
            if (savedRemember) setRememberMe(savedRemember === "true")
        } catch {}
        // Rely on browser's built-in password manager via autocomplete attributes
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const formData = new FormData()
            formData.append("username", email)
            formData.append("password", password)

            const response = await api.post("/auth/login/access-token", formData, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            })

            const { access_token } = response.data
            setToken(access_token)
            try { window.localStorage.setItem("loginAt", String(Date.now())) } catch {}

            try {
                // Persist email preference
                window.localStorage.setItem("auth.rememberMe", String(rememberMe))
                if (rememberMe) {
                    window.localStorage.setItem("auth.rememberEmail", email)
                } else {
                    window.localStorage.removeItem("auth.rememberEmail")
                }
                // Saving passwords is handled by the browser's password manager
            } catch {}

            // Fetch user details
            const userResponse = await api.get("/users/me", {
                headers: { Authorization: `Bearer ${access_token}` },
            })
            setUser(userResponse.data)

            router.push("/")
        } catch {
            setError("Invalid email or password")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
            <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
                <div className="hidden lg:flex items-center justify-center p-10">
                    <div className="text-white">
                        <h1 className="text-4xl font-bold tracking-tight">AssignWell</h1>
                        <p className="mt-4 text-lg opacity-90">Plan smarter. Feel better. Achieve more.</p>
                        <div className="mt-10 grid grid-cols-2 gap-4 opacity-95">
                            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                                <p className="text-sm">Smart schedule</p>
                                <p className="mt-1 text-xl font-semibold">AI-assisted planning</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                                <p className="text-sm">Wellbeing first</p>
                                <p className="mt-1 text-xl font-semibold">Mood-aware insights</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                                <p className="text-sm">Stay on track</p>
                                <p className="mt-1 text-xl font-semibold">Goals & sessions</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                                <p className="text-sm">Beautiful UI</p>
                                <p className="mt-1 text-xl font-semibold">Modern and fast</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center p-6 lg:p-12">
                    <Card className="w-full max-w-md bg-white/80 shadow-2xl backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-2xl">Welcome back</CardTitle>
                            <CardDescription>Sign in to continue to your dashboard</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleLogin}>
                            <CardContent>
                                <div className="grid w-full items-center gap-4">
                                    <div className="flex flex-col space-y-1.5">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            name="username"
                                            type="email"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email username"
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                        <Label htmlFor="password">Password</Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                            />
                                            <span>Remember me</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={savePassword}
                                                onChange={(e) => setSavePassword(e.target.checked)}
                                            />
                                            <span>Save password</span>
                                        </label>
                                    </div>
                                    {error && <p className="text-sm text-red-500">{error}</p>}
                                </div>
                            </CardContent>
                            <CardFooter className="flex items-center justify-between">
                                <Button variant="outline" type="button" onClick={() => router.push("/register")}>
                                    Create account
                                </Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? "Signing in..." : "Sign In"}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    )
}
