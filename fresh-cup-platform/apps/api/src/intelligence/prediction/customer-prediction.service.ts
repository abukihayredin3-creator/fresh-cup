import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { CustomerIntelligenceService } from "../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import { ConfidenceCalibratorService } from "../calibration/confidence-calibrator.service";
import { FeatureStoreService } from "../features/feature-store.service";
import type { CustomerFeatureVector } from "../features/dto/feature-vector.dto";
import {
  scoreFromWeights,
  topReasons,
  type FeatureContribution,
} from "../models/feature-scoring.util";
import { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import type { PredictionResultDto } from "./dto/prediction-result.dto";

/**
 * A weight vector is a documented, hand-tuned linear model — not fit by
 * gradient descent (same "no Python ML service" transparency as the rest
 * of this codebase's statistics). Positive weight = pushes the prediction
 * up as that feature increases; negative = pushes it down.
 */
interface ModelSpec {
  modelKey: string;
  weights: Record<string, number>;
  bias: number;
  actionFor: (score: number) => string;
}

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

@Injectable()
export class CustomerPredictionService {
  constructor(
    private readonly featureStore: FeatureStoreService,
    private readonly customerIntelligence: CustomerIntelligenceService,
    private readonly calibrator: ConfidenceCalibratorService,
    private readonly registry: ModelRegistryV2Service,
  ) {}

  /** Sample-size-based confidence: a customer's own order history is the "sample" a behavioral prediction rests on. */
  private confidenceFor(features: CustomerFeatureVector): number {
    return this.calibrator.normalize(0.3 + Math.min(features.ordersCount, 13) * 0.05);
  }

  private async modelVersionFor(modelKey: string): Promise<number> {
    const latest = await this.registry.latestRun(modelKey);
    return latest?.version ?? 1;
  }

  private async buildResult(
    spec: ModelSpec,
    features: CustomerFeatureVector,
  ): Promise<PredictionResultDto> {
    const { score, contributions } = scoreFromWeights(
      features as unknown as Record<string, number>,
      spec.weights,
      spec.bias,
    );
    return {
      modelKey: spec.modelKey,
      modelVersion: await this.modelVersionFor(spec.modelKey),
      prediction: Math.round(score * 1000) / 1000,
      confidence: this.confidenceFor(features),
      topReasons: topReasons(contributions),
      contributingFactors: contributions as FeatureContribution[],
      suggestedAction: spec.actionFor(score),
    };
  }

  async lifetimeValue(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const profile = await this.customerIntelligence.customerProfile(actor, userId);
    const avgOrderValueEtb = toBirr(profile.avgOrderValue);
    const direction = (positive: boolean): FeatureContribution["direction"] =>
      positive ? "positive" : "negative";

    const unsorted: FeatureContribution[] = [
      {
        feature: "avgOrderValueEtb",
        value: avgOrderValueEtb,
        weight: 1,
        contribution: avgOrderValueEtb,
        direction: direction(true),
      },
      {
        feature: "purchaseFrequency",
        value: profile.purchaseFrequencyDays ?? 0,
        weight: profile.purchaseFrequencyDays ? -1 : 0,
        contribution: profile.purchaseFrequencyDays ? -profile.purchaseFrequencyDays : 0,
        direction: direction(
          Boolean(profile.purchaseFrequencyDays && profile.purchaseFrequencyDays < 30),
        ),
      },
      {
        feature: "churnRisk",
        value: profile.churnRisk,
        weight: -1,
        contribution: -profile.churnRisk,
        direction: direction(profile.churnRisk <= 0.5),
      },
    ];
    const contributions = unsorted.sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );

    return {
      modelKey: "customer-lifetime-value",
      modelVersion: await this.modelVersionFor("customer-lifetime-value"),
      prediction: toBirr(profile.predictedLtv),
      confidence: this.calibrator.normalize(0.3 + Math.min(profile.ordersCount, 13) * 0.05),
      topReasons: topReasons(contributions),
      contributingFactors: contributions,
      suggestedAction:
        profile.churnRisk > 0.5
          ? "High predicted value but elevated churn risk — prioritize retention outreach."
          : "Healthy predicted value and low churn risk — a good candidate for a loyalty upsell.",
    };
  }

  async repeatPurchaseProbability(
    actor: RequestUser,
    userId: string,
  ): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "repeat-purchase-probability",
        weights: { visitFrequencyPerMonth: 0.6, daysSinceLastVisit: -0.015, ordersCount: 0.08 },
        bias: -0.5,
        actionFor: (s) =>
          s >= 0.6
            ? "No action needed — likely to return on their own."
            : "Send a re-engagement push notification or a small time-limited discount.",
      },
      features,
    );
  }

  async churnPrediction(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-churn",
        weights: { daysSinceLastVisit: 0.02, visitFrequencyPerMonth: -0.5, ordersCount: -0.05 },
        bias: -1,
        actionFor: (s) =>
          s >= 0.6
            ? "High churn risk — reach out with a personalized win-back offer."
            : "Low churn risk — continue standard engagement.",
      },
      features,
    );
  }

  async upsellPrediction(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-upsell",
        weights: { avgOrderValueEtb: 0.01, loyaltyLevel: 0.4, favoriteCategoryCount: 0.2 },
        bias: -1.5,
        actionFor: (s) =>
          s >= 0.6
            ? "Good upsell candidate — suggest a larger size or premium add-on at checkout."
            : "Not a strong upsell fit right now — keep standard recommendations.",
      },
      features,
    );
  }

  async crossSellPrediction(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-cross-sell",
        weights: { favoriteCategoryCount: 0.5, ordersCount: 0.05, visitFrequencyPerMonth: 0.3 },
        bias: -1.2,
        actionFor: (s) =>
          s >= 0.6
            ? "Good cross-sell candidate — surface complementary-category items."
            : "Limited cross-category signal yet — wait for more order history.",
      },
      features,
    );
  }

  async couponResponsePrediction(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-coupon-response",
        weights: { avgOrderValueEtb: -0.01, churnRisk: 0.8, daysSinceLastVisit: 0.01 },
        bias: -0.5,
        actionFor: (s) =>
          s >= 0.6
            ? "Likely to respond to a coupon — a good win-back target for the next campaign."
            : "Unlikely to need a discount to return — save the margin.",
      },
      features,
    );
  }

  async referralProbability(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-referral-probability",
        weights: { loyaltyLevel: 0.5, visitFrequencyPerMonth: 0.4, totalSpendEtb: 0.0005 },
        bias: -1.5,
        actionFor: (s) =>
          s >= 0.6
            ? "Strong referral candidate — invite them to share their referral code."
            : "Not an obvious referral target yet — build more loyalty first.",
      },
      features,
    );
  }

  async satisfactionPrediction(actor: RequestUser, userId: string): Promise<PredictionResultDto> {
    const features = await this.featureStore.customerFeatures(actor, userId);
    return await this.buildResult(
      {
        modelKey: "customer-satisfaction",
        weights: { visitFrequencyPerMonth: 0.4, churnRisk: -1.0, ordersCount: 0.05 },
        bias: 0,
        actionFor: (s) =>
          s >= 0.6
            ? "Behavioral signals suggest satisfaction — a good candidate for a review request."
            : "Behavioral signals suggest possible dissatisfaction — consider a direct check-in.",
      },
      features,
    );
  }

  /** Runs every model for one customer — the `GET /admin/ai/predictions/customer/:userId` aggregate endpoint. */
  async allPredictions(actor: RequestUser, userId: string) {
    const [clv, repeatPurchase, churn, upsell, crossSell, couponResponse, referral, satisfaction] =
      await Promise.all([
        this.lifetimeValue(actor, userId),
        this.repeatPurchaseProbability(actor, userId),
        this.churnPrediction(actor, userId),
        this.upsellPrediction(actor, userId),
        this.crossSellPrediction(actor, userId),
        this.couponResponsePrediction(actor, userId),
        this.referralProbability(actor, userId),
        this.satisfactionPrediction(actor, userId),
      ]);
    return {
      clv,
      repeatPurchase,
      churn,
      upsell,
      crossSell,
      couponResponse,
      referral,
      satisfaction,
    };
  }
}
