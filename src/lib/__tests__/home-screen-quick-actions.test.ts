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

  it("exposes the public guest shortcuts with their renamed destinations", () => {
    const actions = buildHomeScreenQuickActions(false, null);

    expect(actions.map((action) => action.id)).toEqual([
      "scan-certificate",
      "certificates",
      "market",
      "search",
    ]);
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "scan-certificate",
          title: "Scan certificate",
          params: { href: "/scan-certificate" },
        }),
        expect.objectContaining({
          id: "certificates",
          title: "Certificates",
          params: { href: "/verify-certificate-portals" },
        }),
        expect.objectContaining({
          id: "market",
          title: "Market",
          params: { href: "/(marketplace)/(tabs)/market" },
        }),
        expect.objectContaining({
          id: "search",
          title: "Search",
          params: { href: "/(marketplace)/(tabs)/search" },
        }),
      ]),
    );
  });
});
