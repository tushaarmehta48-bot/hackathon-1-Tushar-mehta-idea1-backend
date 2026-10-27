/** Online deposit checkout + webhooks. Off by default until a gateway is configured. */
export function isOnlinePaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true';
}

export function isDepositRequiredForPolicy(policyDepositRequired: boolean): boolean {
  return isOnlinePaymentsEnabled() && policyDepositRequired;
}
