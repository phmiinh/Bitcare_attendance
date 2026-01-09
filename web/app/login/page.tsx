"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { authApi } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { LogIn, Loader2, Clock } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useUiToast } from "@/lib/ui-toast"

export default function LoginPage() {
  const { t, language, setLanguage } = useI18n()
  const { login } = useAuth()
  const router = useRouter()
  const toast = useUiToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const res = await authApi.login({ email, password })

    if (res.data) {
      login(res.data.user)
      toast("success", "loginSuccess")
      router.push("/dashboard")
    } else if (res.error) {
      // Check if error is about disabled account
      if (res.error.message?.toLowerCase().includes("disabled") || res.error.message?.toLowerCase().includes("vô hiệu")) {
        setError(t.auth.accountDisabled)
      } else {
        setError(res.error.message || t.auth.loginError)
      }
    } else {
      setError(t.common.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Cột trái: Ảnh nền - chỉ hiện trên desktop */}
      <div
        className="hidden lg:flex flex-1 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/login-bg.jpg')",
          backgroundPosition: "left center",
        }}
      />

      {/* Cột phải: Form login cố định */}
      <div className="relative flex-1 lg:flex-none lg:w-[500px] flex items-center justify-center p-4 sm:p-8 bg-background">
        {/* Thanh công cụ trên cùng: theme + ngôn ngữ */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <ThemeToggle />
          <div className="flex overflow-hidden rounded-full border border-border bg-background/60 shadow-sm">
            <button
              type="button"
              onClick={() => setLanguage("vi")}
              className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                language === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <Card className="w-full max-w-md border-border/60 bg-card shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{t.common.appName}</CardTitle>
          <CardDescription>{t.auth.loginSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {t.auth.loginButton}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
