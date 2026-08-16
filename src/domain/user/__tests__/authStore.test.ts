import { describe, expect, it } from "vitest";
import { normalizeStore } from "../../store/migration";
import type { AuthUser } from "../../../repositories/authRepository";
import { mergeAuthenticatedStoreSources, scopeStoreToAuthenticatedUser } from "../authStore";

const authUser: AuthUser = {
  id: "auth_1",
  email: "owner@example.com",
  displayName: "Owner",
  role: "admin",
  status: "active",
  createdAt: 10,
  updatedAt: 20,
};

describe("scopeStoreToAuthenticatedUser", () => {
  it("keeps only the matching legacy user's data", () => {
    const store = normalizeStore({
      users: [
        { id: "owner", name: "Old Owner", email: "OWNER@example.com" },
        { id: "other", name: "Other", email: "other@example.com" },
      ],
      vehicles: [
        { id: "owner_car", userId: "owner", nickname: "Mine", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
        { id: "other_car", userId: "other", nickname: "Other", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
      ],
      fuelRecords: [
        { id: "owner_fuel", userId: "owner", vehicleId: "owner_car", date: "2026-01-01", volume: 1, pricePerUnit: 1, totalCost: 1, station: "", fullTank: false },
        { id: "other_fuel", userId: "other", vehicleId: "other_car", date: "2026-01-01", volume: 1, pricePerUnit: 1, totalCost: 1, station: "", fullTank: false },
      ],
    });

    const scoped = scopeStoreToAuthenticatedUser(store, authUser);

    expect(scoped.currentUserId).toBe("owner");
    expect(scoped.users).toHaveLength(1);
    expect(scoped.users[0]).toMatchObject({ id: "owner", name: "Owner", email: "owner@example.com" });
    expect(scoped.vehicles.map((vehicle) => vehicle.id)).toEqual(["owner_car"]);
    expect(scoped.fuelRecords.map((record) => record.id)).toEqual(["owner_fuel"]);
  });

  it("creates an empty local profile when no legacy email matches", () => {
    const scoped = scopeStoreToAuthenticatedUser(normalizeStore(undefined), authUser);

    expect(scoped.currentUserId).toBe("auth_1");
    expect(scoped.users[0]).toMatchObject({ id: "auth_1", name: "Owner", email: "owner@example.com" });
    expect(scoped.vehicles).toEqual([]);
  });

  it("keeps an already isolated account Store when the authenticated email changes", () => {
    const store = normalizeStore({
      users: [{ id: "legacy_owner", name: "Owner", email: "old@example.com" }],
      vehicles: [
        { id: "owner_car", userId: "legacy_owner", nickname: "Mine", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
      ],
      currentUserId: "legacy_owner",
    });
    const changedAuthUser = { ...authUser, email: "new@example.com", updatedAt: 30 };

    const scoped = scopeStoreToAuthenticatedUser(store, changedAuthUser);

    expect(scoped.currentUserId).toBe("legacy_owner");
    expect(scoped.users[0]).toMatchObject({ id: "legacy_owner", email: "new@example.com" });
    expect(scoped.vehicles.map((vehicle) => vehicle.id)).toEqual(["owner_car"]);
  });

  it("merges a matching browser legacy backup with an authenticated backend Store", () => {
    const backendStore = normalizeStore({
      users: [{ id: "owner", name: "Owner", email: "owner@example.com" }],
      vehicles: [
        { id: "backend_car", userId: "owner", nickname: "Backend", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
      ],
    });
    const browserStore = normalizeStore({
      users: [{ id: "owner", name: "Owner", email: "OWNER@example.com" }],
      vehicles: [
        { id: "browser_car", userId: "owner", nickname: "Browser", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
      ],
    });

    const result = mergeAuthenticatedStoreSources(backendStore, browserStore, authUser);

    expect(result.importedLegacy).toBe(true);
    expect(result.store.vehicles.map((vehicle) => vehicle.id).sort()).toEqual(["backend_car", "browser_car"]);
  });

  it("does not import a browser backup owned by another email", () => {
    const browserStore = normalizeStore({
      users: [{ id: "other", name: "Other", email: "other@example.com" }],
      vehicles: [
        { id: "other_car", userId: "other", nickname: "Other", brand: "", model: "", year: "", plate: "", energyType: "汽油" },
      ],
    });

    const result = mergeAuthenticatedStoreSources(normalizeStore(undefined), browserStore, authUser);

    expect(result.importedLegacy).toBe(false);
    expect(result.store.vehicles).toEqual([]);
  });
});
