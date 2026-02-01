"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { notesApi, type NoteDTO } from "@/lib/notes-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function EditNotePage(): React.ReactElement {
  const router = useRouter()
  const params = useParams()
  const noteId = Number(params.id)

  const [note, setNote] = useState<NoteDTO | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ title?: string }>({})

  const fetchNote = useCallback(async (): Promise<void> => {
    try {
      const data = await notesApi.get(noteId)
      setNote(data)
      setTitle(data.title)
      setContent(data.content || "")
    } catch (err) {
      toast.error("Failed to load note")
      router.push("/plugins/notes")
    } finally {
      setIsLoading(false)
    }
  }, [noteId, router])

  useEffect(() => {
    if (noteId) {
      fetchNote()
    }
  }, [noteId, fetchNote])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrors({})

    if (!title.trim()) {
      setErrors({ title: "Title is required" })
      return
    }

    setIsSubmitting(true)
    try {
      await notesApi.update(noteId, {
        title: title.trim(),
        content: content.trim() || undefined,
      })
      toast.success("Note updated!")
      router.push("/plugins/notes")
    } catch (err) {
      toast.error("Failed to update note")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!note) {
    return <></>
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
          <CardTitle>Edit Note</CardTitle>
          <CardDescription>
            Last updated: {new Date(note.updatedAt || note.createdAt).toLocaleString()}
          </CardDescription>
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
                    Saving...
                  </>
                ) : (
                  "Save Changes"
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
