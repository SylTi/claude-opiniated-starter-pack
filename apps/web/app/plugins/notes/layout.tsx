"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { notesApi, type PluginStatusDTO } from "@/lib/notes-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { FileText, Loader2, AlertCircle } from "lucide-react"

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [pluginStatus, setPluginStatus] = useState<PluginStatusDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnabling, setIsEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    const checkPluginStatus = async (): Promise<void> => {
      try {
        const status = await notesApi.getPluginStatus()
        setPluginStatus(status)
        setError(null)
      } catch (err) {
        // Plugin might not be registered or tenant not set
        setError("Unable to load plugin status. Make sure you have a tenant selected.")
      } finally {
        setIsLoading(false)
      }
    }

    checkPluginStatus()
  }, [user, authLoading, router])

  const handleEnablePlugin = async (): Promise<void> => {
    setIsEnabling(true)
    try {
      await notesApi.enablePlugin()
      const status = await notesApi.getPluginStatus()
      setPluginStatus(status)
      toast.success("Notes plugin enabled!")
    } catch (err) {
      toast.error("Failed to enable plugin")
    } finally {
      setIsEnabling(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return <></>
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Plugin Error</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!pluginStatus?.enabled) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Notes Plugin</CardTitle>
            </div>
            <CardDescription>
              The Notes plugin allows you to create and manage notes for your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This plugin is not enabled for your tenant. Enable it to start taking notes.
            </p>
            <Button
              onClick={handleEnablePlugin}
              disabled={isEnabling}
              data-testid="enable-plugin-button"
            >
              {isEnabling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Enable Notes Plugin"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {children}
      </div>
    </div>
  )
}
