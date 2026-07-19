import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { CustomerSegmentationService } from "./customer-segmentation.service";
import { KMeansClusteringStrategy } from "./kmeans-clustering.strategy";
import { RuleBasedClusteringStrategy } from "./rule-based-clustering.strategy";

const admin: RequestUser = { id: "admin-1", role: "ADMIN" as never, branchId: null };
const manager: RequestUser = { id: "mgr-1", role: "MANAGER" as never, branchId: "branch-1" };

describe("CustomerSegmentationService", () => {
  function makeService() {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { userId: "u1", total: 5000, placedAt: new Date(), user: { fullName: "Abebe" } },
          { userId: "u1", total: 3000, placedAt: new Date(), user: { fullName: "Abebe" } },
          { userId: "u2", total: 10000, placedAt: new Date(), user: { fullName: "Sara" } },
        ]),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const service = new CustomerSegmentationService(
      prisma,
      new RuleBasedClusteringStrategy(),
      new KMeansClusteringStrategy(),
    );
    return { service, prisma };
  }

  it("aggregates orders per customer and clusters them with the default rule-based strategy", async () => {
    const { service } = makeService();
    const assignments = await service.segment(admin);
    expect(assignments).toHaveLength(2);
    expect(assignments.find((a) => a.userId === "u1")!.fullName).toBe("Abebe");
  });

  it("scopes managers to their own branch regardless of the requested branchId", async () => {
    const { service, prisma } = makeService();
    await service.segment(manager, "some-other-branch");
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "branch-1" }) }),
    );
  });

  it("respects the requested clustering strategy", async () => {
    const { service } = makeService();
    const ruleBased = await service.segment(admin, undefined, "rule-based");
    const kmeans = await service.segment(admin, undefined, "kmeans");
    expect(ruleBased).toHaveLength(2);
    expect(kmeans).toHaveLength(2);
  });

  it("summary() aggregates counts per segment", async () => {
    const { service } = makeService();
    const summary = await service.summary(admin);
    const total = summary.reduce((sum, s) => sum + s.customerCount, 0);
    expect(total).toBe(2);
  });
});
