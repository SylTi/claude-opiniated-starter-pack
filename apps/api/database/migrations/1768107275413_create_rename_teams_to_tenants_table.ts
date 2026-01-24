import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    // 1. Rename tables
    await this.db.rawQuery(`ALTER TABLE teams RENAME TO tenants;`)
    await this.db.rawQuery(`ALTER TABLE team_members RENAME TO tenant_memberships;`)
    await this.db.rawQuery(`ALTER TABLE team_invitations RENAME TO tenant_invitations;`)

    // 2. Rename foreign key columns in tenant_memberships
    await this.db.rawQuery(`ALTER TABLE tenant_memberships RENAME COLUMN team_id TO tenant_id;`)

    // 3. Rename foreign key columns in tenant_invitations
    await this.db.rawQuery(`ALTER TABLE tenant_invitations RENAME COLUMN team_id TO tenant_id;`)

    // 4. Rename column in users table
    await this.db.rawQuery(`ALTER TABLE users RENAME COLUMN current_team_id TO current_tenant_id;`)

    // 5. Add type column to tenants (personal vs team) with constraint
    await this.db.rawQuery(`
      ALTER TABLE tenants
      ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'team'
      CONSTRAINT tenants_type_check CHECK (type IN ('personal', 'team'));
    `)

    // 7. Rename sequences (PostgreSQL auto-names them based on table)
    await this.db.rawQuery(`ALTER SEQUENCE IF EXISTS teams_id_seq RENAME TO tenants_id_seq;`)
    await this.db.rawQuery(
      `ALTER SEQUENCE IF EXISTS team_members_id_seq RENAME TO tenant_memberships_id_seq;`
    )
    await this.db.rawQuery(
      `ALTER SEQUENCE IF EXISTS team_invitations_id_seq RENAME TO tenant_invitations_id_seq;`
    )

    // 8. Rename indexes (if they exist with old names)
    await this.db.rawQuery(`ALTER INDEX IF EXISTS teams_pkey RENAME TO tenants_pkey;`)
    await this.db.rawQuery(
      `ALTER INDEX IF EXISTS team_members_pkey RENAME TO tenant_memberships_pkey;`
    )
    await this.db.rawQuery(
      `ALTER INDEX IF EXISTS team_invitations_pkey RENAME TO tenant_invitations_pkey;`
    )
  }

  async down(): Promise<void> {
    // Remove type column (constraint is dropped automatically with column)
    await this.db.rawQuery(`ALTER TABLE tenants DROP COLUMN IF EXISTS type;`)

    // Rename columns back
    await this.db.rawQuery(`ALTER TABLE users RENAME COLUMN current_tenant_id TO current_team_id;`)
    await this.db.rawQuery(`ALTER TABLE tenant_invitations RENAME COLUMN tenant_id TO team_id;`)
    await this.db.rawQuery(`ALTER TABLE tenant_memberships RENAME COLUMN tenant_id TO team_id;`)

    // Rename tables back
    await this.db.rawQuery(`ALTER TABLE tenant_invitations RENAME TO team_invitations;`)
    await this.db.rawQuery(`ALTER TABLE tenant_memberships RENAME TO team_members;`)
    await this.db.rawQuery(`ALTER TABLE tenants RENAME TO teams;`)

    // Rename sequences back
    await this.db.rawQuery(`ALTER SEQUENCE IF EXISTS tenants_id_seq RENAME TO teams_id_seq;`)
    await this.db.rawQuery(
      `ALTER SEQUENCE IF EXISTS tenant_memberships_id_seq RENAME TO team_members_id_seq;`
    )
    await this.db.rawQuery(
      `ALTER SEQUENCE IF EXISTS tenant_invitations_id_seq RENAME TO team_invitations_id_seq;`
    )

    // Rename indexes back
    await this.db.rawQuery(`ALTER INDEX IF EXISTS tenants_pkey RENAME TO teams_pkey;`)
    await this.db.rawQuery(
      `ALTER INDEX IF EXISTS tenant_memberships_pkey RENAME TO team_members_pkey;`
    )
    await this.db.rawQuery(
      `ALTER INDEX IF EXISTS tenant_invitations_pkey RENAME TO team_invitations_pkey;`
    )
  }
}
