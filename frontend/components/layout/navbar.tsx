
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, User } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
    const pathname = usePathname()

    return (
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            AssignWell
                        </span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/"
                            className={`transition-colors hover:text-foreground/80 ${pathname === "/" ? "text-foreground" : "text-foreground/60"
                                }`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/assignments"
                            className={`transition-colors hover:text-foreground/80 ${pathname === "/assignments" ? "text-foreground" : "text-foreground/60"
                                }`}
                        >
                            Assignments
                        </Link>
                        <Link
                            href="/wellbeing"
                            className={`transition-colors hover:text-foreground/80 ${pathname === "/wellbeing" ? "text-foreground" : "text-foreground/60"
                                }`}
                        >
                            Well-Being
                        </Link>
                        <Link
                            href="/peer-support"
                            className={`transition-colors hover:text-foreground/80 ${pathname === "/peer-support" ? "text-foreground" : "text-foreground/60"
                                }`}
                        >
                            Peer Support
                        </Link>
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search or other controls could go here */}
                    </div>
                    <nav className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon">
                            <Bell className="h-4 w-4" />
                            <span className="sr-only">Notifications</span>
                        </Button>
                        <Button variant="ghost" size="icon">
                            <User className="h-4 w-4" />
                            <span className="sr-only">Profile</span>
                        </Button>
                    </nav>
                </div>
            </div>
        </nav>
    )
}
