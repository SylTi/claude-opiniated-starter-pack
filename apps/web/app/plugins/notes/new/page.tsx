"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { notesApi } from "@/lib/notes-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function NewNotePage(): React.ReactElement {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ title?: string }>({})

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrors({})

    if (!title.trim()) {
      setErrors({ title: "Title is required" })
      return
    }

    setIsSubmitting(true)
    try {
      await notesApi.create({ title: title.trim(), content: content.trim() || undefined })
      toast.success("Note created!")
      router.push("/plugins/notes")
    } catch {
      toast.error("Failed to create note")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/plugins/notes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Notes
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Note</CardTitle>
          <CardDescription>Add a new note to your collection</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title"
                disabled={isSubmitting}
                data-testid="note-title-input"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note content..."
                rows={8}
                disabled={isSubmitting}
                data-testid="note-content-input"
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting} data-testid="save-note-button">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Note"
                )}
              </Button>
              <Link href="/plugins/notes">
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
