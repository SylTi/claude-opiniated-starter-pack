import type { SubscriptionTierDTO, SubscriptionDTO } from "./subscription.js";
import type { TenantType } from "./tenant.js";

export type UserRole = "admin" | "user" | "guest";

export interface UserDTO {
  id: number;
  email: string;
  fullName: string | null;
  role: UserRole;
  // Current tenant info (billing unit)
  currentTenantId: number | null;
  currentTenant?: {
    id: number;
    name: string;
    slug: string;
    type: TenantType;
    subscription?: SubscriptionDTO | null;
  } | null;
  // Effective subscription tier (from current tenant)
  effectiveSubscriptionTier: SubscriptionTierDTO;
  // User's personal balance (in cents) - deprecated, use tenant balance
  balance: number;
  balanceCurrency: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  fullName?: string;
}

export interface UpdateUserDTO {
  fullName?: string;
  avatarUrl?: string | null;
}

export interface LoginDTO {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponseDTO {
  user?: UserDTO;
  requiresMfa?: boolean;
  message: string;
}

export interface OAuthAccountDTO {
  provider: "google" | "github" | "microsoft";
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  linkedAt: string;
}

export interface LoginHistoryDTO {
  id: number;
  loginMethod: "password" | "google" | "github" | "microsoft" | "mfa";
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface MfaSetupDTO {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaStatusDTO {
  mfaEnabled: boolean;
  backupCodesRemaining: number;
}

export interface AdminUserDTO {
  id: number;
  email: string;
  fullName: string | null;
  role: UserRole;
  currentTenantId: number | null;
  currentTenantName: string | null;
  currentTenantType: TenantType | null;
  balance: number;
  balanceCurrency: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateUserTierDTO {
  subscriptionTier: string;
  subscriptionExpiresAt?: string | null;
}
