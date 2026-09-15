import { buildHomeScreenQuickActions } from "@/lib/home-screen-quick-actions";
import type { UserProfile } from "@/types";

describe("home-screen quick actions", () => {
  it("includes Add cheque for lapidaries", () => {
    const profile = { role: "lapidary" } as UserProfile;
    const actions = buildHomeScreenQuickActions(true, profile);
    const cheque = actions.find((action) => action.id === "cheque");

    expect(cheque).toEqual(
      expect.objectContaining({
        title: "Add cheque",
        params: { href: "/(marketplace)/cheques/add" },
      }),
    );
  });
});
