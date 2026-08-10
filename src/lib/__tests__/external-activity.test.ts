import {
  beginExternalActivity,
  isExternalActivityActive,
  runExternalActivity,
  subscribeToExternalActivity,
} from "@/lib/app-lifecycle/external-activity";

describe("external activity coordinator", () => {
  it("tracks nested activities and releases them independently", () => {
    const endOuter = beginExternalActivity();
    const endInner = beginExternalActivity();

    expect(isExternalActivityActive()).toBe(true);
    endInner();
    expect(isExternalActivityActive()).toBe(true);
    endOuter();
    expect(isExternalActivityActive()).toBe(false);
  });

  it("makes cleanup idempotent", () => {
    const end = beginExternalActivity();
    end();
    end();
    expect(isExternalActivityActive()).toBe(false);
  });

  it("cleans up after a successful or failed operation", async () => {
    await runExternalActivity(async () => "done");
    expect(isExternalActivityActive()).toBe(false);

    await expect(
      runExternalActivity(async () => {
        throw new Error("picker failed");
      }),
    ).rejects.toThrow("picker failed");
    expect(isExternalActivityActive()).toBe(false);
  });

  it("notifies subscribers when activity starts and ends", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToExternalActivity((active) => states.push(active));
    const end = beginExternalActivity();
    end();
    unsubscribe();

    expect(states).toEqual([false, true, false]);
  });
});
