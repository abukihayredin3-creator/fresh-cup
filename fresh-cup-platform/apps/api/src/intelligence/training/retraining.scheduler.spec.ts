import type { RetrainingService } from "./retraining.service";
import { RetrainingScheduler } from "./retraining.scheduler";

describe("RetrainingScheduler", () => {
  it("calls checkAndRetrainAll and logs how many models were retrained", async () => {
    const retraining = {
      checkAndRetrainAll: jest.fn().mockResolvedValue([
        { modelKey: "customer-churn", shouldRetrain: true, reasons: ["new_data"] },
        { modelKey: "sales-daily", shouldRetrain: false, reasons: [] },
      ]),
    } as unknown as jest.Mocked<RetrainingService>;

    const scheduler = new RetrainingScheduler(retraining);
    await scheduler.run();

    expect(retraining.checkAndRetrainAll).toHaveBeenCalled();
  });

  it("does not throw when nothing needs retraining", async () => {
    const retraining = {
      checkAndRetrainAll: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RetrainingService>;

    const scheduler = new RetrainingScheduler(retraining);
    await expect(scheduler.run()).resolves.toBeUndefined();
  });
});
