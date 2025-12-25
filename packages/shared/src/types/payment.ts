import type { SubscriptionTierDTO, SubscriptionDTO } from "./subscription.js";

export type PaymentInterval = "month" | "year";
export type TaxBehavior = "inclusive" | "exclusive";

/**
 * Price data transfer object
 */
export interface PriceDTO {
  id: number;
  interval: PaymentInterval;
  currency: string;
  unitAmount: number;
  taxBehavior: TaxBehavior;
  isActive: boolean;
}

/**
 * Product data transfer object (links tier to payment provider product)
 */
export interface ProductDTO {
  id: number;
  tierId: number;
  tier: SubscriptionTierDTO;
  prices: PriceDTO[];
}

/**
 * Billing tier DTO (tier with its prices for display)
 */
export interface BillingTierDTO {
  tier: SubscriptionTierDTO;
  prices: PriceDTO[];
}

/**
 * Result of creating a checkout session
 */
export interface CheckoutSessionDTO {
  sessionId: string;
  url: string;
}

/**
 * Result of creating a customer portal session
 */
export interface CustomerPortalDTO {
  url: string;
}

/**
 * Current billing subscription status
 */
export interface BillingSubscriptionDTO {
  subscription: SubscriptionDTO | null;
  canManage: boolean;
  hasPaymentMethod: boolean;
}

/**
 * Request to create a checkout session
 */
export interface CreateCheckoutRequest {
  priceId: number;
  subscriberType?: "user" | "team";
  subscriberId?: number;
}

/**
 * Request to create a customer portal session
 */
export interface CreatePortalRequest {
  returnUrl?: string;
}
