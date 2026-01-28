import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Fix Invitation RLS and Function Grants
 *
 * This migration addresses two issues:
 *
 * 1. Accept/Decline Invitation RLS (CRITICAL):
 *    - /api/v1/invitations/:token/accept and /decline use authContext (user_id only)
 *    - Previous tenant_invitations policy required tenant_id = app_current_tenant_id()
 *    - Fix: Add user-based access for invitations matching user's email
 *    - This allows users to accept/decline invitations without tenant context
 *
 * 2. Function EXECUTE Grants for Non-Supabase (MAJOR):
 *    - Previous migration only granted to Supabase roles (authenticated, anon)
 *    - For non-Supabase deployments, functions remained inaccessible
 *    - Fix: Grant EXECUTE back to PUBLIC for RLS helper functions
 *    - Security is enforced by RLS policies, not function execute permissions
 *    - SET search_path = public already protects against search_path attacks
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // ============================================
    // 1. Fix tenant_invitations RLS policy
    // ============================================

    // The previous policy was:
    //   app_current_user_id() = 0 OR tenant_id = app_current_tenant_id()
    //
    // This blocked accept/decline because:
    // - authContext only sets user_id, not tenant_id
    // - User can't set tenant_id because they're not yet a member
    //
    // New policy allows:
    // - System bypass (user_id = 0)
    // - Tenant admins (tenant_id = app_current_tenant_id())
    // - Users accepting their own invitations (via SECURITY DEFINER function)

    // First, create a function to check if a user can access an invitation
    // This checks if the invitation email matches the current user's email
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION app_can_access_invitation(invitation_email text)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = app_current_user_id()
            AND LOWER(u.email) = LOWER(invitation_email)
        )
      $$;
    `)

    // Grant execute to PUBLIC (security is in the function logic and RLS)
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_can_access_invitation(text) TO PUBLIC;`)

    // Update the tenant_invitations policy
    await this.db.rawQuery(`DROP POLICY IF EXISTS invitations_tenant_access ON tenant_invitations;`)
    await this.db.rawQuery(`
      CREATE POLICY invitations_access ON tenant_invitations
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id = app_current_tenant_id()  -- Tenant admins
          OR app_can_access_invitation(email)  -- Users accepting their own invitations
        );
    `)

    // ============================================
    // 2. Fix function EXECUTE grants for non-Supabase deployments
    // ============================================

    // Grant EXECUTE back to PUBLIC for all RLS helper functions.
    // This is safe because:
    // - These functions only read/write data through RLS-protected tables
    // - SECURITY DEFINER functions have SET search_path = public
    // - The actual security boundary is the RLS policies, not function access
    // - Revoking from PUBLIC was defense-in-depth but breaks non-Supabase deployments

    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_current_user_id() TO PUBLIC;`)
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO PUBLIC;`)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_is_tenant_member(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_check_user_membership(integer, integer) TO PUBLIC;`
    )
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_get_tenant_public(integer) TO PUBLIC;`)
    await this.db.rawQuery(`GRANT EXECUTE ON FUNCTION app_get_invitation_by_token(text) TO PUBLIC;`)
    await this.db.rawQuery(
      `GRANT EXECUTE ON FUNCTION app_update_invitation_status(text, text) TO PUBLIC;`
    )
  }

  async down(): Promise<void> {
    // Restore the original tenant_invitations policy
    await this.db.rawQuery(`DROP POLICY IF EXISTS invitations_access ON tenant_invitations;`)
    await this.db.rawQuery(`
      CREATE POLICY invitations_tenant_access ON tenant_invitations
        FOR ALL
        USING (
          app_current_user_id() = 0  -- System bypass
          OR tenant_id = app_current_tenant_id()
        );
    `)

    // Drop the invitation access check function
    await this.db.rawQuery(`DROP FUNCTION IF EXISTS app_can_access_invitation(text);`)

    // Revoke from PUBLIC (restore previous behavior)
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_current_user_id() FROM PUBLIC;`)
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_current_tenant_id() FROM PUBLIC;`)
    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_is_tenant_member(integer, integer) FROM PUBLIC;`
    )
    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_check_user_membership(integer, integer) FROM PUBLIC;`
    )
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_get_tenant_public(integer) FROM PUBLIC;`)
    await this.db.rawQuery(`REVOKE ALL ON FUNCTION app_get_invitation_by_token(text) FROM PUBLIC;`)
    await this.db.rawQuery(
      `REVOKE ALL ON FUNCTION app_update_invitation_status(text, text) FROM PUBLIC;`
    )
  }
}
