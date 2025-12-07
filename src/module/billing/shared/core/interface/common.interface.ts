/**
 * Type-safe metadata for JSON columns
 * Use unknown instead of any to enforce type checking
 */
export type JsonMetadata = Record<string, unknown>;

/**
 * Billing address structure (compatible with Address from tax-calculation.interface)
 */
export interface BillingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
}
