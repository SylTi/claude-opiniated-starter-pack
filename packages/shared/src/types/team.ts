import type { SubscriptionDTO } from "./subscription.js";

export type TeamRole = "owner" | "admin" | "member";

export interface TeamDTO {
  id: number;
  name: string;
  slug: string;
  subscription?: SubscriptionDTO | null;
  ownerId: number | null;
  maxMembers: number | null;
  memberCount?: number;
  balance: number;
  balanceCurrency: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface TeamMemberDTO {
  id: number;
  userId: number;
  teamId: number;
  role: TeamRole;
  user?: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export interface CreateTeamDTO {
  name: string;
}

export interface UpdateTeamDTO {
  name?: string;
}

export interface UpdateTeamSubscriptionDTO {
  subscriptionTier: string;
  subscriptionExpiresAt?: string | null;
}

export interface AddTeamMemberDTO {
  email: string;
  role?: TeamRole;
}

export interface UpdateTeamMemberDTO {
  role: TeamRole;
}

export interface TeamWithMembersDTO extends TeamDTO {
  members: TeamMemberDTO[];
}

// Team Invitation types
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";
export type InvitationRole = "admin" | "member";

export interface TeamInvitationDTO {
  id: number;
  teamId: number;
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
  team: {
    id: number;
    name: string;
    slug: string;
  };
  invitedBy: {
    id: number;
    email: string;
    fullName: string | null;
  };
  expiresAt: string;
}

export interface AcceptInvitationResponseDTO {
  teamId: number;
  teamName: string;
  role: InvitationRole;
}

// Admin team types
export interface AdminTeamDTO {
  id: number;
  name: string;
  slug: string;
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
