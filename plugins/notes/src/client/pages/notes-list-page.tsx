'use client'

import { useEffect, useState, useCallback } from 'react'
import { notesApi } from '../api'
import type { NoteDTO } from '../../types'
import { useNotesI18n } from '../../translations'
import { Button } from '@saas/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@saas/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, FileText, Trash2, Pencil, Loader2 } from 'lucide-react'

interface NotesListPageProps {
  onNavigate: (path: string) => void
}

export function NotesListPage({ onNavigate }: NotesListPageProps): React.ReactElement {
  const { locale, t } = useNotesI18n()
  const [notes, setNotes] = useState<NoteDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteNote, setDeleteNote] = useState<NoteDTO | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchNotes = useCallback(async (): Promise<void> => {
    try {
      const data = await notesApi.list()
      setNotes(data)
    } catch {
      toast.error(t('ui.list.loadErrorToast'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleDelete = async (): Promise<void> => {
    if (!deleteNote) return

    setIsDeleting(true)
    try {
      await notesApi.delete(deleteNote.id)
      setNotes((prev) => prev.filter((n) => n.id !== deleteNote.id))
      toast.success(t('ui.list.deleteSuccessToast'))
    } catch {
      toast.error(t('ui.list.deleteErrorToast'))
    } finally {
      setIsDeleting(false)
      setDeleteNote(null)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('ui.list.title')}</h1>
          <p className="text-muted-foreground">{t('ui.list.subtitle')}</p>
        </div>
        <Button data-testid="create-note-button" onClick={() => onNavigate('/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('ui.list.newNote')}
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('ui.list.emptyTitle')}</h3>
            <p className="text-muted-foreground mb-4">{t('ui.list.emptyMessage')}</p>
            <Button data-testid="create-first-note-button" onClick={() => onNavigate('/new')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('ui.list.createNote')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow" data-testid={`note-card-${note.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-1">{note.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onNavigate(`/${note.id}`)}
                      data-testid={`edit-note-${note.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteNote(note)}
                      data-testid={`delete-note-${note.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {formatDate(note.updatedAt || note.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {note.content || t('ui.list.noContent')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteNote} onOpenChange={() => setDeleteNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ui.list.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ui.list.deleteDialogDescription', { title: deleteNote?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('ui.list.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-button"
            >
              {isDeleting ? t('ui.list.deleting') : t('ui.list.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
