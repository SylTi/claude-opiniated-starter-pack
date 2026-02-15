'use client'

import { useEffect, useState, useCallback } from 'react'
import { notesApi } from '../api'
import type { NoteDTO } from '../../types'
import { useNotesI18n } from '../../translations'
import { Button } from '@saas/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas/ui/card'
import { Input } from '@saas/ui/input'
import { Label } from '@saas/ui/label'
import { Textarea } from '@saas/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface NoteEditPageProps {
  noteId: number
  onNavigate: (path: string) => void
}

export function NoteEditPage({ noteId, onNavigate }: NoteEditPageProps): React.ReactElement {
  const { locale, t } = useNotesI18n()
  const [note, setNote] = useState<NoteDTO | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ title?: string }>({})

  const fetchNote = useCallback(async (): Promise<void> => {
    try {
      const data = await notesApi.get(noteId)
      setNote(data)
      setTitle(data.title)
      setContent(data.content || '')
    } catch {
      toast.error(t('ui.edit.loadErrorToast'))
      onNavigate('/')
    } finally {
      setIsLoading(false)
    }
  }, [noteId, onNavigate, t])

  useEffect(() => {
    if (noteId) {
      fetchNote()
    }
  }, [noteId, fetchNote])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrors({})

    if (!title.trim()) {
      setErrors({ title: t('ui.form.titleRequired') })
      return
    }

    setIsSubmitting(true)
    try {
      await notesApi.update(noteId, {
        title: title.trim(),
        content: content.trim() || undefined,
      })
      toast.success(t('ui.edit.updateSuccessToast'))
      onNavigate('/')
    } catch {
      toast.error(t('ui.edit.updateErrorToast'))
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
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('ui.edit.backToNotes')}
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('ui.edit.title')}</CardTitle>
          <CardDescription>
            {t('ui.edit.lastUpdated', {
              date: new Date(note.updatedAt || note.createdAt).toLocaleString(locale),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('ui.edit.fieldTitle')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('ui.edit.titlePlaceholder')}
                disabled={isSubmitting}
                data-testid="note-title-input"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">{t('ui.edit.fieldContent')}</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('ui.edit.contentPlaceholder')}
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
                    {t('ui.edit.saving')}
                  </>
                ) : (
                  t('ui.edit.saveChanges')
                )}
              </Button>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onNavigate('/')}>
                {t('ui.edit.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
