export type DiscountType = "percent" | "fixed";

export interface DiscountCodeDTO {
  id: number;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  currency: string | null;
  minAmount: number | null;
  maxUses: number | null;
  maxUsesPerTenant: number | null;
  timesUsed: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateDiscountCodeDTO {
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  currency?: string | null;
  minAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerTenant?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface UpdateDiscountCodeDTO {
  code?: string;
  description?: string | null;
  discountType?: DiscountType;
  discountValue?: number;
  currency?: string | null;
  minAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerTenant?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface DiscountCodeUsageDTO {
  id: number;
  discountCodeId: number;
  tenantId: number;
  tenantName: string;
  userId: number;
  userEmail: string;
  usedAt: string;
  checkoutSessionId: string | null;
}

export interface CouponDTO {
  id: number;
  code: string;
  description: string | null;
  creditAmount: number;
  currency: string;
  expiresAt: string | null;
  isActive: boolean;
  redeemedByUserId: number | null;
  redeemedByUserEmail: string | null;
  redeemedForTenantId: number | null;
  redeemedForTenantName: string | null;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCouponDTO {
  code: string;
  description?: string | null;
  creditAmount: number;
  currency?: string;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface UpdateCouponDTO {
  code?: string;
  description?: string | null;
  creditAmount?: number;
  currency?: string;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface ValidateDiscountCodeRequest {
  code: string;
  priceId: number;
  tenantId: number;
}

export interface ValidateDiscountCodeResponse {
  valid: boolean;
  discountCode?: DiscountCodeDTO;
  originalAmount: number;
  discountedAmount: number;
  discountApplied: number;
  message?: string;
}

export interface RedeemCouponRequest {
  code: string;
  tenantId: number;
}

export interface RedeemCouponResponse {
  success: boolean;
  creditAmount: number;
  currency: string;
  newBalance: number;
  message?: string;
}

export interface BalanceDTO {
  balance: number;
  currency: string;
}
