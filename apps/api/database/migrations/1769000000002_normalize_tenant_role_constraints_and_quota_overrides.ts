import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    await this.db.rawQuery(`
      ALTER TABLE public.tenants
      ADD COLUMN IF NOT EXISTS quota_overrides jsonb;
    `)

    await this.db.rawQuery(`
      UPDATE public.tenants
      SET quota_overrides = '{}'::jsonb
      WHERE quota_overrides IS NULL;
    `)

    await this.db.rawQuery(`
      ALTER TABLE public.tenants
      ALTER COLUMN quota_overrides SET DEFAULT '{}'::jsonb;
    `)

    await this.db.rawQuery(`
      ALTER TABLE public.tenants
      ALTER COLUMN quota_overrides SET NOT NULL;
    `)

    await this.db.rawQuery(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        IF to_regclass('public.tenant_memberships') IS NOT NULL THEN
          FOR constraint_name IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            JOIN pg_attribute att ON att.attrelid = rel.oid
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'tenant_memberships'
              AND con.contype = 'c'
              AND att.attnum = ANY (con.conkey)
              AND att.attname = 'role'
          LOOP
            EXECUTE format(
              'ALTER TABLE public.tenant_memberships DROP CONSTRAINT IF EXISTS %I',
              constraint_name
            );
          END LOOP;

          ALTER TABLE public.tenant_memberships
          ADD CONSTRAINT tenant_memberships_role_check
          CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
        END IF;
      END;
      $$;
    `)

    await this.db.rawQuery(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        IF to_regclass('public.tenant_invitations') IS NOT NULL THEN
          FOR constraint_name IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            JOIN pg_attribute att ON att.attrelid = rel.oid
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'tenant_invitations'
              AND con.contype = 'c'
              AND att.attnum = ANY (con.conkey)
              AND att.attname = 'role'
          LOOP
            EXECUTE format(
              'ALTER TABLE public.tenant_invitations DROP CONSTRAINT IF EXISTS %I',
              constraint_name
            );
          END LOOP;

          ALTER TABLE public.tenant_invitations
          ADD CONSTRAINT tenant_invitations_role_check
          CHECK (role IN ('admin', 'member', 'viewer'));
        END IF;
      END;
      $$;
    `)

    await this.db.rawQuery(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        IF to_regclass('public.tenant_sso_configs') IS NOT NULL THEN
          FOR constraint_name IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            JOIN pg_attribute att ON att.attrelid = rel.oid
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'tenant_sso_configs'
              AND con.contype = 'c'
              AND att.attnum = ANY (con.conkey)
              AND att.attname = 'default_role'
          LOOP
            EXECUTE format(
              'ALTER TABLE public.tenant_sso_configs DROP CONSTRAINT IF EXISTS %I',
              constraint_name
            );
          END LOOP;

          ALTER TABLE public.tenant_sso_configs
          ADD CONSTRAINT tenant_sso_configs_default_role_check
          CHECK (default_role IN ('owner', 'admin', 'member', 'viewer'));
        END IF;
      END;
      $$;
    `)
  }

  async down(): Promise<void> {
    // No-op: this migration normalizes drifted constraints/non-null defaults.
  }
}
