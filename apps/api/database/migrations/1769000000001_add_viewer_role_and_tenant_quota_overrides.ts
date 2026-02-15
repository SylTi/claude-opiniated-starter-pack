import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.alterTable('tenants', (table) => {
      table.jsonb('quota_overrides').notNullable().defaultTo('{}')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE tenant_memberships
        DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_memberships
        DROP CONSTRAINT IF EXISTS team_members_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_memberships
        ADD CONSTRAINT tenant_memberships_role_check
        CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
      `)

      await db.rawQuery(`
        ALTER TABLE tenant_invitations
        DROP CONSTRAINT IF EXISTS tenant_invitations_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_invitations
        DROP CONSTRAINT IF EXISTS team_invitations_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_invitations
        ADD CONSTRAINT tenant_invitations_role_check
        CHECK (role IN ('admin', 'member', 'viewer'));
      `)

      await db.rawQuery(`
        ALTER TABLE tenant_sso_configs
        DROP CONSTRAINT IF EXISTS tenant_sso_configs_default_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_sso_configs
        ADD CONSTRAINT tenant_sso_configs_default_role_check
        CHECK (default_role IN ('owner', 'admin', 'member', 'viewer'));
      `)
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable('tenants', (table) => {
      table.dropColumn('quota_overrides')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE tenant_memberships
        DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_memberships
        ADD CONSTRAINT tenant_memberships_role_check
        CHECK (role IN ('owner', 'admin', 'member'));
      `)

      await db.rawQuery(`
        ALTER TABLE tenant_invitations
        DROP CONSTRAINT IF EXISTS tenant_invitations_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_invitations
        ADD CONSTRAINT tenant_invitations_role_check
        CHECK (role IN ('admin', 'member'));
      `)

      await db.rawQuery(`
        ALTER TABLE tenant_sso_configs
        DROP CONSTRAINT IF EXISTS tenant_sso_configs_default_role_check;
      `)
      await db.rawQuery(`
        ALTER TABLE tenant_sso_configs
        ADD CONSTRAINT tenant_sso_configs_default_role_check
        CHECK (default_role IN ('owner', 'admin', 'member'));
      `)
    })
  }
}
