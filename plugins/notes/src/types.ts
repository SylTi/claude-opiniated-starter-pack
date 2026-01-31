/**
 * Notes Plugin Types
 *
 * Type definitions for the notes plugin.
 */

/**
 * Note entity.
 */
export interface Note {
  id: number
  tenantId: number
  userId: number
  title: string
  content: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Create note request.
 */
export interface CreateNoteDTO {
  title: string
  content?: string
}

/**
 * Update note request.
 */
export interface UpdateNoteDTO {
  title?: string
  content?: string
}

/**
 * Note response.
 */
export interface NoteDTO {
  id: number
  title: string
  content: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Notes plugin abilities.
 */
export const NOTES_ABILITIES = {
  NOTE_READ: 'notes.note.read',
  NOTE_WRITE: 'notes.note.write',
  NOTE_DELETE: 'notes.note.delete',
} as const

export type NotesAbility = (typeof NOTES_ABILITIES)[keyof typeof NOTES_ABILITIES]
