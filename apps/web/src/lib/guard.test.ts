import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Backend twin (Feature A6). The service-role key bypasses RLS, so these
 * helpers are the *only* thing standing between a forged request and the data.
 * Supabase is mocked — these assert the guard's logic, not the network.
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@vmd/supabase", () => ({
  createServiceClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}));

const { AuthzError, assertSameFarm, getUserIdFromAuthHeader, rateLimit, requireApproved } =
  await import("./guard");

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
});

describe("getUserIdFromAuthHeader", () => {
  it("rejects a missing header", async () => {
    await expect(getUserIdFromAuthHeader(null)).rejects.toThrow(/missing bearer token/);
  });

  it("rejects a non-bearer scheme", async () => {
    await expect(getUserIdFromAuthHeader("Basic abc123")).rejects.toThrow(/missing bearer token/);
  });

  it("rejects an empty bearer token", async () => {
    await expect(getUserIdFromAuthHeader("Bearer   ")).rejects.toThrow(/missing bearer token/);
  });

  it("rejects a token the auth server won't validate", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    await expect(getUserIdFromAuthHeader("Bearer forged")).rejects.toThrow(/invalid token/);
  });

  it("returns the id for a valid token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(getUserIdFromAuthHeader("Bearer good")).resolves.toBe("u1");
  });

  it("verifies against the auth server rather than decoding the JWT locally", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await getUserIdFromAuthHeader("Bearer good");
    expect(getUser).toHaveBeenCalledWith("good");
  });

  it("attaches a 401 status", async () => {
    try {
      await getUserIdFromAuthHeader(null);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthzError);
      expect((err as InstanceType<typeof AuthzError>).status).toBe(401);
    }
  });
});

describe("requireApproved", () => {
  it("rejects a pending account", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "pending", farm_id: "f1", role: "worker" }, error: null });
    await expect(requireApproved("u1")).rejects.toThrow(/pending owner approval/);
  });

  it("rejects a disabled account", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "disabled", farm_id: "f1", role: "worker" }, error: null });
    await expect(requireApproved("u1")).rejects.toThrow(/disabled/);
  });

  it("rejects an account with no profile row", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(requireApproved("u1")).rejects.toThrow(/no profile/);
  });

  it("allows an active account and returns its farm", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", status: "active", farm_id: "f1", role: "owner" },
      error: null,
    });
    await expect(requireApproved("u1")).resolves.toMatchObject({
      userId: "u1",
      farmId: "f1",
      role: "owner",
    });
  });

  it("degrades gracefully when the column doesn't exist yet (pre-migration)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'column "status" does not exist' } });
    await expect(requireApproved("u1")).resolves.toMatchObject({ userId: "u1", status: "active" });
  });

  it("attaches a 403 status to a refusal", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "pending", farm_id: "f1", role: "worker" }, error: null });
    try {
      await requireApproved("u1");
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as InstanceType<typeof AuthzError>).status).toBe(403);
    }
  });
});

describe("assertSameFarm", () => {
  const caller = { userId: "u1", email: null, farmId: "f1", role: "owner", status: "active" };

  it("allows a write inside the caller's own farm", () => {
    expect(() => assertSameFarm(caller, "f1")).not.toThrow();
  });

  it("blocks a write aimed at another farm", () => {
    expect(() => assertSameFarm(caller, "f2")).toThrow(/cross-farm/);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then throws 429", () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(() => rateLimit(key, 5, 60_000)).not.toThrow();
    try {
      rateLimit(key, 5, 60_000);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as InstanceType<typeof AuthzError>).status).toBe(429);
    }
  });

  it("keys buckets independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(a, 5, 60_000);
    expect(() => rateLimit(b, 5, 60_000)).not.toThrow();
  });

  it("forgets hits once the window has passed", () => {
    vi.useFakeTimers();
    const key = `w-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 1_000);
    expect(() => rateLimit(key, 3, 1_000)).toThrow();
    vi.advanceTimersByTime(1_500);
    expect(() => rateLimit(key, 3, 1_000)).not.toThrow();
    vi.useRealTimers();
  });
});
