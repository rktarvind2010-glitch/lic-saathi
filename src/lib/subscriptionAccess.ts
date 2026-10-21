export type SubscriptionPlanName =
  | "Starter"
  | "Standard"
  | "Premium";

export type SubscriptionStatus =
  | "pending"
  | "trial"
  | "active"
  | "expired"
  | "cancelled";

export type SubscriptionFeature =
  | "customers"
  | "policies"
  | "basicReminders"
  | "applicationTracking"
  | "commissionTracking"
  | "advancedReports"
  | "csvExport"
  | "customerHistory"
  | "advancedCollectionReports"
  | "whatsappReminders"
  | "prioritySupport";

export type SubscriptionAccessRecord = {
  plan_name: SubscriptionPlanName;
  status: SubscriptionStatus;
};

const planFeatures: Record<
  SubscriptionPlanName,
  readonly SubscriptionFeature[]
> = {
  Starter: [
    "customers",
    "policies",
    "basicReminders",
  ],

  Standard: [
    "customers",
    "policies",
    "basicReminders",
    "applicationTracking",
    "commissionTracking",
    "advancedReports",
    "csvExport",
  ],

  Premium: [
    "customers",
    "policies",
    "basicReminders",
    "applicationTracking",
    "commissionTracking",
    "advancedReports",
    "csvExport",
    "customerHistory",
    "advancedCollectionReports",
    "whatsappReminders",
    "prioritySupport",
  ],
};

/**
 * UI helper only.
 * A subscription must be active or authorized trial
 * before its plan features are considered available.
 *
 * This is not a security boundary. Enforce access
 * on the server/database before launching paid plans.
 */
export function canUseSubscriptionFeature(
  subscription: SubscriptionAccessRecord | null,
  feature: SubscriptionFeature,
): boolean {
  if (!subscription) return false;

  if (
    subscription.status !== "active" &&
    subscription.status !== "trial"
  ) {
    return false;
  }

  return planFeatures[subscription.plan_name].includes(feature);
}

export function getPlanFeatures(
  planName: SubscriptionPlanName,
): readonly SubscriptionFeature[] {
  return planFeatures[planName];
}
