import type { RequestUser } from "../../common/types/request-user.interface";
import { CoordinatorAgentService } from "./coordinator-agent.service";
import type { AgentAnswer, DomainAgent } from "./agent.types";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };

function fakeAgent(key: string, keywords: string[], confidence: number): DomainAgent {
  return {
    key,
    name: `${key} Agent`,
    domain: key,
    keywords,
    answer: jest.fn().mockImplementation(async (): Promise<AgentAnswer> => ({
      agentKey: key,
      agentName: `${key} Agent`,
      domain: key,
      summary: `${key} summary`,
      confidence,
      insights: [],
    })),
  };
}

describe("CoordinatorAgentService", () => {
  function makeCoordinator() {
    const sales = fakeAgent("sales", ["sales", "revenue"], 0.8);
    const marketing = fakeAgent("marketing", ["marketing", "campaign"], 0.6);
    const inventory = fakeAgent("inventory", ["inventory", "stock"], 0.9);
    const kitchen = fakeAgent("kitchen", ["kitchen", "prep"], 0.5);
    const delivery = fakeAgent("delivery", ["delivery", "driver"], 0.4);
    const finance = fakeAgent("finance", ["finance", "profit"], 0.7);
    const hr = fakeAgent("hr", ["hr", "staff"], 0.3);
    const executive = fakeAgent("executive", ["overall", "business"], 1);

    const coordinator = new CoordinatorAgentService(
      sales as never,
      marketing as never,
      inventory as never,
      kitchen as never,
      delivery as never,
      finance as never,
      hr as never,
      executive as never,
    );
    return { coordinator, sales, marketing, inventory, executive };
  }

  it("routes to agents whose keywords match the question", () => {
    const { coordinator, sales } = makeCoordinator();
    const routed = coordinator.route("How is our sales revenue trending?");
    expect(routed.map((a) => a.key)).toContain("sales");
    expect(sales.keywords).toContain("sales");
  });

  it("falls back to the executive agent when nothing matches", () => {
    const { coordinator } = makeCoordinator();
    const routed = coordinator.route("asdkjaslkdj nonsense");
    expect(routed).toHaveLength(1);
    expect(routed[0]!.key).toBe("executive");
  });

  it("ranks agents with more keyword matches first", () => {
    const { coordinator } = makeCoordinator();
    const routed = coordinator.route("inventory stock levels");
    expect(routed[0]!.key).toBe("inventory");
  });

  it("ask() calls every routed agent and averages confidence", async () => {
    const { coordinator, sales, marketing } = makeCoordinator();
    const result = await coordinator.ask(ACTOR, "sales and marketing campaign performance", "b1");

    expect(sales.answer).toHaveBeenCalledWith(ACTOR, "b1", expect.any(String));
    expect(marketing.answer).toHaveBeenCalled();
    expect(result.routedAgents).toEqual(expect.arrayContaining(["sales", "marketing"]));
    expect(result.confidence).toBeCloseTo(0.7, 5);
    expect(result.synthesis).toContain("sales summary");
  });

  it("listAgents returns all 8 agents", () => {
    const { coordinator } = makeCoordinator();
    expect(coordinator.listAgents()).toHaveLength(8);
  });
});
