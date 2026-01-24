import type { SubscriptionDTO } from "./subscription.js";

export type TenantType = "personal" | "team";
export type TenantRole = "owner" | "admin" | "member";

export interface TenantDTO {
  id: number;
  name: string;
  slug: string;
  type: TenantType;
  subscription?: SubscriptionDTO | null;
  ownerId: number | null;
  maxMembers: number | null;
  memberCount?: number;
  balance: number;
  balanceCurrency: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface TenantMembershipDTO {
  id: number;
  userId: number;
  tenantId: number;
  role: TenantRole;
  user?: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export interface CreateTenantDTO {
  name: string;
  slug?: string;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
}

export interface UpdateTenantSubscriptionDTO {
  subscriptionTier: string;
  subscriptionExpiresAt?: string | null;
}

export interface AddTenantMemberDTO {
  email: string;
  role?: TenantRole;
}

export interface UpdateTenantMemberDTO {
  role: TenantRole;
}

export interface TenantWithMembersDTO extends TenantDTO {
  members: TenantMembershipDTO[];
}

// Tenant Invitation types
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";
export type InvitationRole = "admin" | "member";

export interface TenantInvitationDTO {
  id: number;
  tenantId: number;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: string;
  isExpired: boolean;
  invitedBy: {
    id: number;
    email: string;
    fullName: string | null;
  };
  createdAt: string;
}

export interface SendInvitationDTO {
  email: string;
  role?: InvitationRole;
}

export interface InvitationDetailsDTO {
  id: number;
  email: string;
  role: InvitationRole;
  tenant: {
    id: number;
    name: string;
    slug: string;
    type: TenantType;
  };
  invitedBy: {
    id: number;
    email: string;
    fullName: string | null;
  };
  expiresAt: string;
}

export interface AcceptInvitationResponseDTO {
  tenantId: number;
  tenantName: string;
  role: InvitationRole;
}

// Admin tenant types
export interface AdminTenantDTO {
  id: number;
  name: string;
  slug: string;
  type: TenantType;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  ownerId: number | null;
  ownerEmail: string | null;
  memberCount: number;
  balance: number;
  balanceCurrency: string;
  createdAt: string;
  updatedAt: string | null;
}

// Backward compatibility - deprecated types (use Tenant* instead)
/** @deprecated Use TenantRole instead */
export type TeamRole = TenantRole;
/** @deprecated Use TenantDTO instead */
export type TeamDTO = TenantDTO;
/** @deprecated Use TenantMembershipDTO instead */
export type TeamMemberDTO = TenantMembershipDTO;
/** @deprecated Use CreateTenantDTO instead */
export type CreateTeamDTO = CreateTenantDTO;
/** @deprecated Use UpdateTenantDTO instead */
export type UpdateTeamDTO = UpdateTenantDTO;
/** @deprecated Use TenantWithMembersDTO instead */
export type TeamWithMembersDTO = TenantWithMembersDTO;
/** @deprecated Use TenantInvitationDTO instead */
export type TeamInvitationDTO = TenantInvitationDTO;
/** @deprecated Use AdminTenantDTO instead */
export type AdminTeamDTO = AdminTenantDTO;
