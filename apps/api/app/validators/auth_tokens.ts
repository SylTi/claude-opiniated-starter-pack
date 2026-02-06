import vine from '@vinejs/vine'

export const createAuthTokenValidator = vine.compile(
  vine.object({
    pluginId: vine.string().trim().minLength(1).maxLength(100),
    kind: vine.string().trim().minLength(1).maxLength(100),
    name: vine.string().trim().minLength(1).maxLength(255),
    scopes: vine.array(vine.string().trim().minLength(1).maxLength(100)).minLength(1),
    expiresAt: vine.string().trim().optional(),
  })
)
