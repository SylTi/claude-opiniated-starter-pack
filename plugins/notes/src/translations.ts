import { useCallback, useEffect, useState } from 'react'
import { getActiveLocale, subscribeToLocale, translatePlugin, type PluginTranslations } from '@saas/plugins-core'

const NOTES_EN_CATALOG = {
  'widget.recentNotes': 'Recent Notes',
  'api.authz.readDenied': 'You do not have permission to read notes',
  'api.authz.createDenied': 'You do not have permission to create notes',
  'api.authz.updateDenied': 'You do not have permission to update notes',
  'api.authz.deleteDenied': 'You do not have permission to delete notes',
  'api.note.notFound': 'Note not found',
  'api.validation.titleRequired': 'Title is required',
  'api.authz.tenantRoleRequired': 'Tenant role is required for notes authorization',
  'api.authz.viewerReadOnly': 'Viewer role is read-only for notes',
  'api.authz.adminOwnerDeleteOnly': 'Only tenant admins and owners can delete notes',
  'api.authz.unknownAbility': 'Unknown ability: {ability}',
  'ui.layout.statusError': 'Unable to load plugin status. Make sure you have a tenant selected.',
  'ui.layout.enabledToast': 'Notes plugin enabled!',
  'ui.layout.enableErrorToast': 'Failed to enable plugin',
  'ui.layout.pluginErrorTitle': 'Plugin Error',
  'ui.layout.backToDashboard': 'Back to Dashboard',
  'ui.layout.pluginTitle': 'Notes Plugin',
  'ui.layout.pluginDescription':
    'The Notes plugin allows you to create and manage notes for your team.',
  'ui.layout.notEnabledDescription':
    'This plugin is not enabled for your tenant. Enable it to start taking notes.',
  'ui.layout.enabling': 'Enabling...',
  'ui.layout.enablePlugin': 'Enable Notes Plugin',
  'ui.list.loadErrorToast': 'Failed to load notes',
  'ui.list.deleteSuccessToast': 'Note deleted',
  'ui.list.deleteErrorToast': 'Failed to delete note',
  'ui.list.title': 'Notes',
  'ui.list.subtitle': 'Create and manage your team notes',
  'ui.list.newNote': 'New Note',
  'ui.list.emptyTitle': 'No notes yet',
  'ui.list.emptyMessage': 'Create your first note to get started',
  'ui.list.createNote': 'Create Note',
  'ui.list.noContent': 'No content',
  'ui.list.deleteDialogTitle': 'Delete Note',
  'ui.list.deleteDialogDescription':
    'Are you sure you want to delete "{title}"? This action cannot be undone.',
  'ui.list.cancel': 'Cancel',
  'ui.list.deleting': 'Deleting...',
  'ui.list.delete': 'Delete',
  'ui.form.titleRequired': 'Title is required',
  'ui.new.createSuccessToast': 'Note created!',
  'ui.new.createErrorToast': 'Failed to create note',
  'ui.new.backToNotes': 'Back to Notes',
  'ui.new.title': 'Create Note',
  'ui.new.subtitle': 'Add a new note to your collection',
  'ui.new.fieldTitle': 'Title',
  'ui.new.titlePlaceholder': 'Enter note title',
  'ui.new.fieldContent': 'Content',
  'ui.new.contentPlaceholder': 'Write your note content...',
  'ui.new.creating': 'Creating...',
  'ui.new.createButton': 'Create Note',
  'ui.new.cancel': 'Cancel',
  'ui.edit.loadErrorToast': 'Failed to load note',
  'ui.edit.updateSuccessToast': 'Note updated!',
  'ui.edit.updateErrorToast': 'Failed to update note',
  'ui.edit.backToNotes': 'Back to Notes',
  'ui.edit.title': 'Edit Note',
  'ui.edit.lastUpdated': 'Last updated: {date}',
  'ui.edit.fieldTitle': 'Title',
  'ui.edit.titlePlaceholder': 'Enter note title',
  'ui.edit.fieldContent': 'Content',
  'ui.edit.contentPlaceholder': 'Write your note content...',
  'ui.edit.saving': 'Saving...',
  'ui.edit.saveChanges': 'Save Changes',
  'ui.edit.cancel': 'Cancel',
} as const

type NotesTranslationKey = keyof typeof NOTES_EN_CATALOG
type NotesTranslationValues = Record<string, string | number>

export const translations: PluginTranslations = {
  en: NOTES_EN_CATALOG,
  fr: {
    'widget.recentNotes': 'Notes récentes',
    'ui.layout.pluginErrorTitle': 'Erreur plugin',
    'ui.layout.backToDashboard': 'Retour au tableau de bord',
    'ui.layout.pluginTitle': 'Plugin Notes',
    'ui.layout.enabling': 'Activation...',
    'ui.layout.enablePlugin': 'Activer le plugin Notes',
    'ui.list.title': 'Notes',
    'ui.list.subtitle': "Créez et gérez les notes de votre équipe",
    'ui.list.newNote': 'Nouvelle note',
    'ui.list.emptyTitle': 'Aucune note',
    'ui.list.emptyMessage': 'Créez votre première note',
    'ui.list.createNote': 'Créer une note',
    'ui.list.noContent': 'Aucun contenu',
    'ui.list.deleteDialogTitle': 'Supprimer la note',
    'ui.list.cancel': 'Annuler',
    'ui.list.deleting': 'Suppression...',
    'ui.list.delete': 'Supprimer',
    'ui.form.titleRequired': 'Le titre est requis',
    'ui.new.backToNotes': 'Retour aux notes',
    'ui.new.title': 'Créer une note',
    'ui.new.subtitle': 'Ajoutez une nouvelle note',
    'ui.new.fieldTitle': 'Titre',
    'ui.new.titlePlaceholder': 'Saisissez le titre',
    'ui.new.fieldContent': 'Contenu',
    'ui.new.contentPlaceholder': 'Écrivez le contenu...',
    'ui.new.creating': 'Création...',
    'ui.new.createButton': 'Créer la note',
    'ui.new.cancel': 'Annuler',
    'ui.edit.backToNotes': 'Retour aux notes',
    'ui.edit.title': 'Modifier la note',
    'ui.edit.lastUpdated': 'Dernière mise à jour : {date}',
    'ui.edit.fieldTitle': 'Titre',
    'ui.edit.titlePlaceholder': 'Saisissez le titre',
    'ui.edit.fieldContent': 'Contenu',
    'ui.edit.contentPlaceholder': 'Écrivez le contenu...',
    'ui.edit.saving': 'Enregistrement...',
    'ui.edit.saveChanges': 'Enregistrer',
    'ui.edit.cancel': 'Annuler',
  },
}

export function notesText(
  key: NotesTranslationKey,
  values?: NotesTranslationValues,
  options?: { locale?: string; defaultValue?: string }
): string {
  return translatePlugin('notes', key, {
    locale: options?.locale,
    values,
    defaultValue: options?.defaultValue ?? NOTES_EN_CATALOG[key],
  })
}

export function useNotesI18n(): {
  locale: string
  t: (key: NotesTranslationKey, values?: NotesTranslationValues) => string
} {
  const [locale, setLocale] = useState<string>(() => getActiveLocale())

  useEffect(() => {
    const unsubscribe = subscribeToLocale((nextLocale: string) => {
      setLocale(nextLocale)
    })
    return unsubscribe
  }, [])

  const t = useCallback(
    (key: NotesTranslationKey, values?: NotesTranslationValues) =>
      translatePlugin('notes', key, {
        locale,
        values,
        defaultValue: NOTES_EN_CATALOG[key],
      }),
    [locale]
  )

  return { locale, t }
}
