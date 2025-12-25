export type SubscriptionStatus = "active" | "expired" | "cancelled";
export type SubscriberType = "user" | "team";

// Tier slug type for convenience
export type SubscriptionTier = "free" | "tier1" | "tier2";

// Tier display labels
export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  tier1: "Tier 1",
  tier2: "Tier 2",
};

// Tier access levels for comparison
export const SUBSCRIPTION_TIER_LEVELS: Record<SubscriptionTier, number> = {
  free: 0,
  tier1: 1,
  tier2: 2,
};

export interface SubscriptionTierDTO {
  id: number;
  slug: string;
  name: string;
  level: number;
  maxTeamMembers: number | null;
  priceMonthly: number | null;
  yearlyDiscountPercent: number | null;
  features: Record<string, unknown> | null;
  isActive: boolean;
}

export interface SubscriptionDTO {
  id: number;
  subscriberType: SubscriberType;
  subscriberId: number;
  tier: SubscriptionTierDTO;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string | null;
  providerName: string | null;
  providerSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateSubscriptionDTO {
  tierSlug: string;
  expiresAt?: string | null;
}

export interface UpdateSubscriptionDTO {
  tierSlug?: string;
  expiresAt?: string | null;
  status?: SubscriptionStatus;
}
