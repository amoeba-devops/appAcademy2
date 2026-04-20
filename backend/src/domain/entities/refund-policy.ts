export class RefundPolicy {
  id: number;
  academyId: number;
  version: number;
  basis: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefaultTemplate: boolean;
  createdBy: number | null;
  createdAt: Date;
  tiers: RefundPolicyTier[];
}

export class RefundPolicyTier {
  id: number;
  policyId: number;
  tierOrder: number;
  elapsedRatioMin: number;
  elapsedRatioMax: number;
  refundRate: number;
  note: string | null;
}
