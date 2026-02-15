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
 *
 * NOTE: Methods return Promise<void> because route registration is async
 * (middleware collection is lazily loaded). Always await route registrations.
 */
interface RoutesRegistrar {
  get(path: string, handler: (ctx: HttpContext) => Promise<void> | void): Promise<void>
  post(path: string, handler: (ctx: HttpContext) => Promise<void> | void): Promise<void>
  put(path: string, handler: (ctx: HttpContext) => Promise<void> | void): Promise<void>
  delete(path: string, handler: (ctx: HttpContext) => Promise<void> | void): Promise<void>
}
import type { CreateNoteDTO, UpdateNoteDTO, NoteDTO } from './types.js'
import { NOTES_ABILITIES } from './types.js'
import { notesText } from './translations.js'

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
  tenantDb?: TenantDbClient
  plugin?: {
    id: string
    grantedCapabilities: string[]
  }
}

type DbQueryResult<T> = { rows: T[] }

interface TenantDbClient {
  rawQuery<T = unknown>(sql: string, bindings?: unknown[]): Promise<DbQueryResult<T>>
}

type NotesTenantRole = 'owner' | 'admin' | 'member' | 'viewer'

function normalizeTenantRole(role: unknown): NotesTenantRole | null {
  if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer') {
    return role
  }
  return null
}

type NoteRow = {
  id: number
  tenant_id: number
  user_id: number
  title: string
  content: string | null
  created_at: string
  updated_at: string
}

function serializeNote(row: NoteRow): NoteDTO {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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
  const tenantRole = normalizeTenantRole(ctx.tenant?.membership?.role)
  const authzCtx: AuthzContext = {
    tenantId: ctx.tenant!.id,
    userId: ctx.auth.user!.id,
    tenantRole: tenantRole ?? undefined,
  }

  const decision = await authzResolver(authzCtx, { ability })
  return { allowed: decision.allow, reason: decision.reason }
}

/**
 * Register plugin routes.
 */
export async function register(context: PluginContext): Promise<void> {
  const { routes } = context

  // GET /api/v1/apps/notes/notes - List notes
  await routes.get('/notes', async (ctx: HttpContext) => {
    // Check read permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_READ)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || notesText('api.authz.readDenied'),
      })
    }

    const result = await ctx.tenantDb!.rawQuery<NoteRow>(
      `SELECT id, tenant_id, user_id, title, content, created_at, updated_at
       FROM plugin_notes_notes
       WHERE tenant_id = ?
       ORDER BY created_at DESC`,
      [ctx.tenant!.id]
    )

    ctx.response.json({ data: result.rows.map(serializeNote) })
  })

  // GET /api/v1/apps/notes/notes/:id - Get note
  await routes.get('/notes/:id', async (ctx: HttpContext) => {
    // Check read permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_READ)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || notesText('api.authz.readDenied'),
      })
    }

    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)
    const result = await ctx.tenantDb!.rawQuery<NoteRow>(
      `SELECT id, tenant_id, user_id, title, content, created_at, updated_at
       FROM plugin_notes_notes
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
      [ctx.tenant!.id, noteId]
    )
    const note = result.rows[0]

    if (!note) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: notesText('api.note.notFound'),
      })
    }

    ctx.response.json({ data: serializeNote(note) })
  })

  // POST /api/v1/apps/notes/notes - Create note
  await routes.post('/notes', async (ctx: HttpContext) => {
    // Check write permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_WRITE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || notesText('api.authz.createDenied'),
      })
    }

    const body = ctx.request.body() as unknown as CreateNoteDTO

    if (!body.title || body.title.trim() === '') {
      return ctx.response.unprocessableEntity({
        error: 'ValidationError',
        message: notesText('api.validation.titleRequired'),
        errors: [{ field: 'title', message: notesText('api.validation.titleRequired'), rule: 'required' }],
      })
    }

    const insertResult = await ctx.tenantDb!.rawQuery<NoteRow>(
      `INSERT INTO plugin_notes_notes (
         tenant_id, user_id, title, content, created_at, updated_at
       )
       VALUES (?, ?, ?, NULLIF(?, ''), NOW(), NOW())
       RETURNING id, tenant_id, user_id, title, content, created_at, updated_at`,
      [ctx.tenant!.id, ctx.auth.user!.id, body.title.trim(), body.content ?? '']
    )

    ctx.response.created({ data: serializeNote(insertResult.rows[0]) })
  })

  // PUT /api/v1/apps/notes/notes/:id - Update note
  await routes.put('/notes/:id', async (ctx: HttpContext) => {
    // Check write permission
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_WRITE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || notesText('api.authz.updateDenied'),
      })
    }

    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)
    const body = ctx.request.body() as unknown as UpdateNoteDTO

    const existingResult = await ctx.tenantDb!.rawQuery<NoteRow>(
      `SELECT id, tenant_id, user_id, title, content, created_at, updated_at
       FROM plugin_notes_notes
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
      [ctx.tenant!.id, noteId]
    )
    const existing = existingResult.rows[0]
    if (!existing) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: notesText('api.note.notFound'),
      })
    }

    const nextTitle = body.title !== undefined ? body.title.trim() : existing.title
    const nextContent = body.content !== undefined ? body.content : existing.content

    if (!nextTitle) {
      return ctx.response.unprocessableEntity({
        error: 'ValidationError',
        message: notesText('api.validation.titleRequired'),
        errors: [{ field: 'title', message: notesText('api.validation.titleRequired'), rule: 'required' }],
      })
    }

    const updateResult = await ctx.tenantDb!.rawQuery<NoteRow>(
      `UPDATE plugin_notes_notes
       SET title = ?, content = NULLIF(?, ''), updated_at = NOW()
       WHERE tenant_id = ? AND id = ?
       RETURNING id, tenant_id, user_id, title, content, created_at, updated_at`,
      [nextTitle, nextContent ?? '', ctx.tenant!.id, noteId]
    )

    ctx.response.json({ data: serializeNote(updateResult.rows[0]) })
  })

  // DELETE /api/v1/apps/notes/notes/:id - Delete note
  await routes.delete('/notes/:id', async (ctx: HttpContext) => {
    // Check delete permission (more restrictive than write)
    const authz = await checkAuthz(ctx, NOTES_ABILITIES.NOTE_DELETE)
    if (!authz.allowed) {
      return ctx.response.forbidden({
        error: 'AuthzDenied',
        message: authz.reason || notesText('api.authz.deleteDenied'),
      })
    }

    const noteId = parseInt(ctx.request.param('id') ?? '0', 10)
    const deleteResult = await ctx.tenantDb!.rawQuery<{ id: number }>(
      `DELETE FROM plugin_notes_notes
       WHERE tenant_id = ? AND id = ?
       RETURNING id`,
      [ctx.tenant!.id, noteId]
    )

    if (deleteResult.rows.length === 0) {
      return ctx.response.notFound({
        error: 'NoteNotFound',
        message: notesText('api.note.notFound'),
      })
    }
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
  const role = normalizeTenantRole(ctx.tenantRole)

  if (!role) {
    return {
      allow: false,
      reason: notesText('api.authz.tenantRoleRequired'),
    }
  }

  switch (ability) {
    case NOTES_ABILITIES.NOTE_READ:
      return { allow: true }

    case NOTES_ABILITIES.NOTE_WRITE:
      return {
        allow: role === 'owner' || role === 'admin' || role === 'member',
        reason: role === 'viewer' ? notesText('api.authz.viewerReadOnly') : undefined,
      }

    case NOTES_ABILITIES.NOTE_DELETE:
      return {
        allow: role === 'owner' || role === 'admin',
        reason:
          role === 'member' || role === 'viewer'
            ? notesText('api.authz.adminOwnerDeleteOnly')
            : undefined,
      }

    default:
      // Unknown ability - deny (fail-closed)
      return {
        allow: false,
        reason: notesText('api.authz.unknownAbility', { ability }),
      }
  }
}

// Export types
export type { NoteDTO, CreateNoteDTO, UpdateNoteDTO }
export { NOTES_ABILITIES }
