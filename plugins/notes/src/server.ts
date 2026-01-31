/**
 * Notes Plugin - Server Entrypoint
 *
 * A Tier B plugin demonstrating:
 * - CRUD routes under /api/v1/apps/notes
 * - Tenant-scoped database tables with RLS
 * - Plugin-specific authorization
 *
 * ⚠️ ═══════════════════════════════════════════════════════════════════════ ⚠️
 * ⚠️  DEMO ONLY - NOT FOR PRODUCTION USE                                     ⚠️
 * ⚠️                                                                          ⚠️
 * ⚠️  This plugin uses IN-MEMORY storage that will be lost on server restart ⚠️
 * ⚠️  and a simplified authz resolver that doesn't check actual permissions.  ⚠️
 * ⚠️                                                                          ⚠️
 * ⚠️  For production:                                                         ⚠️
 * ⚠️  1. Use proper Lucid models with ctx.tenantDb                           ⚠️
 * ⚠️  2. Implement RBAC checks against plugin_notes_roles tables              ⚠️
 * ⚠️  3. Add proper input validation                                         ⚠️
 * ⚠️ ═══════════════════════════════════════════════════════════════════════ ⚠️
 */

import type { AuthzContext, AuthzCheck, AuthzDecision } from '@saas/shared'

/**
 * Routes registrar interface.
 * Provided by the plugin system at registration time.
 */
interface RoutesRegistrar {
  get(path: string, handler: (ctx: HttpContext) => Promise<void> | void): void
  post(path: string, handler: (ctx: HttpContext) => Promise<void> | void): void
  put(path: string, handler: (ctx: HttpContext) => Promise<void> | void): void
  delete(path: string, handler: (ctx: HttpContext) => Promise<void> | void): void
}
import type { CreateNoteDTO, UpdateNoteDTO, NoteDTO } from './types.js'
import { NOTES_ABILITIES } from './types.js'

/**
 * Plugin context passed during registration.
 */
interface PluginContext {
  routes: RoutesRegistrar
  pluginId: string
  manifest: unknown
}

/**
 * HTTP Context type (simplified for plugin use).
 */
interface HttpContext {
  request: {
    body: () => Record<string, unknown>
    param: (key: string) => string | undefined
  }
  response: {
    json: (data: unknown) => void
    created: (data: unknown) => void
    noContent: () => void
    notFound: (data: unknown) => void
    forbidden: (data: unknown) => void
    unprocessableEntity: (data: unknown) => void
  }
  auth: {
    user?: { id: number }
  }
  tenant?: {
    id: number
    membership: { role: string }
  }
  tenantDb?: unknown
  plugin?: {
    id: string
    grantedCapabilities: string[]
  }
}

/**
 * ⚠️ WARNING: IN-MEMORY STORAGE - DEMO ONLY ⚠️
 *
 * This is a simplified in-memory store for demonstration purposes.
 * DO NOT use this pattern in production!
 *
 * Issues with this approach:
 * - Data is lost on server restart
 * - Not thread-safe in multi-worker deployments
 * - No persistence across requests in serverless environments
 *
 * In production, use the actual database with proper models:
 * - Create a PluginNotesNote model extending BaseModel
 * - Use ctx.tenantDb for tenant-scoped queries
 * - Leverage RLS policies created by migrations
 */
const notesStore: Map<string, NoteDTO[]> = new Map()

let noteIdCounter = 1

function getNotesForTenant(tenantId: number): NoteDTO[] {
  const key = `tenant:${tenantId}`
  if (!notesStore.has(key)) {
    notesStore.set(key, [])
  }
  return notesStore.get(key)!
}

/**
 * Check authorization for a notes ability.
 *
 * ⚠️ DEMO: This is a simplified check that uses the authzResolver directly.
 * In production, this would call the actual AuthzService via dependency injection.
 */
async function checkAuthz(
  ctx: HttpContext,
  ability: string
): Promise<{ allowed: boolean; reason?: string }> {
  const authzCtx: AuthzContext = {
    tenantId: ctx.tenant!.id,
    userId: ctx.auth.user!.id,
  }

  const decision = await authzResolver(authzCtx, { ability })
  return { allowed: decision.allow, reason: decision.reason }
}

/**
 * Register plugin routes.
 */
export function register(context: PluginContext): void {
  const { routes } = context

  // GET /api/v1/apps/notes/notes - List notes
  routes.get('/notes', async (ctx: HttpContext) => {
    // Check read permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_READ)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || 'You do not have permission to read notes',
      })
    }

    const tenantId = ctx.tenant!.id
    const notes = getNotesForTenant(tenantId)
    ctx.response.json({ data: notes })
  })

  // GET /api/v1/apps/notes/notes/:id - Get note
  routes.get('/notes/:id', async (ctx: HttpContext) => {
    // Check read permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_READ)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || 'You do not have permission to read notes',
      })
    }

    const tenantId = ctx.tenant!.id
    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)

    const notes = getNotesForTenant(tenantId)
    const note = notes.find((n) => n.id === noteId)

    if (!note) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: 'Note not found',
      })
    }

    ctx.response.json({ data: note })
  })

  // POST /api/v1/apps/notes/notes - Create note
  routes.post('/notes', async (ctx: HttpContext) => {
    // Check write permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_WRITE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || 'You do not have permission to create notes',
      })
    }

    const tenantId = ctx.tenant!.id
    const body = ctx.request.body() as unknown as CreateNoteDTO

    if (!body.title || body.title.trim() === '') {
      return ctx.response.unprocessableEntity({
        error: 'ValidationError',
        message: 'Title is required',
        errors: [{ field: 'title', message: 'Title is required', rule: 'required' }],
      })
    }

    const now = new Date().toISOString()
    const note: NoteDTO = {
      id: noteIdCounter++,
      title: body.title,
      content: body.content ?? null,
      createdAt: now,
      updatedAt: now,
    }

    const notes = getNotesForTenant(tenantId)
    notes.push(note)

    ctx.response.created({ data: note })
  })

  // PUT /api/v1/apps/notes/notes/:id - Update note
  routes.put('/notes/:id', async (ctx: HttpContext) => {
    // Check write permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_WRITE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || 'You do not have permission to update notes',
      })
    }

    const tenantId = ctx.tenant!.id
    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)
    const body = ctx.request.body() as unknown as UpdateNoteDTO

    const notes = getNotesForTenant(tenantId)
    const noteIndex = notes.findIndex((n) => n.id === noteId)

    if (noteIndex === -1) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: 'Note not found',
      })
    }

    const note = notes[noteIndex]
    if (body.title !== undefined) {
      note.title = body.title
    }
    if (body.content !== undefined) {
      note.content = body.content
    }
    note.updatedAt = new Date().toISOString()

    ctx.response.json({ data: note })
  })

  // DELETE /api/v1/apps/notes/notes/:id - Delete note
  routes.delete('/notes/:id', async (ctx: HttpContext) => {
    // Check delete permission (more restrictive than write)
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_DELETE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || 'You do not have permission to delete notes',
      })
    }

    const tenantId = ctx.tenant!.id
    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)

    const notes = getNotesForTenant(tenantId)
    const noteIndex = notes.findIndex((n) => n.id === noteId)

    if (noteIndex === -1) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: 'Note not found',
      })
    }

    notes.splice(noteIndex, 1)
    ctx.response.noContent()
  })

  console.log('[notes] Plugin routes registered')
}

/**
 * Authorization resolver for the notes namespace.
 *
 * Handles abilities like:
 * - notes.note.read
 * - notes.note.write
 * - notes.note.delete
 *
 * ⚠️ DEMO IMPLEMENTATION ⚠️
 * This resolver uses simplified logic for demonstration.
 * In production, implement proper RBAC checks against plugin_notes_roles tables.
 */
export async function authzResolver(
  ctx: AuthzContext,
  check: AuthzCheck
): Promise<AuthzDecision> {
  const { ability } = check

  // ⚠️ WARNING: This is a simplified demo resolver.
  // In production, query plugin_notes_roles tables for proper RBAC.

  switch (ability) {
    case NOTES_ABILITIES.NOTE_READ:
      // All tenant members can read notes
      return { allow: true }

    case NOTES_ABILITIES.NOTE_WRITE:
      // All tenant members can write notes (demo only)
      // In production: check plugin_notes_role_abilities for write permission
      return { allow: true }

    case NOTES_ABILITIES.NOTE_DELETE:
      // ⚠️ DEMO: Always allows delete. In production, check role:
      // In production, this would query plugin_notes_roles for admin/owner role
      // or check plugin_notes_role_abilities for delete permission.
      // Example production check:
      // const hasPermission = await checkPluginRole(ctx.tenantId, ctx.userId, 'notes.note.delete')
      // return { allow: hasPermission, reason: hasPermission ? undefined : 'Requires delete permission' }
      return {
        allow: true,
        reason: '⚠️ Demo mode: delete always allowed. Implement RBAC in production.',
      }

    default:
      // Unknown ability - deny (fail-closed)
      return {
        allow: false,
        reason: `Unknown ability: ${ability}`,
      }
  }
}

// Export types
export type { NoteDTO, CreateNoteDTO, UpdateNoteDTO }
export { NOTES_ABILITIES }
