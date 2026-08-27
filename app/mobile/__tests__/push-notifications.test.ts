import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  syncPushNotificationToken,
  upsertPushNotificationPreference,
} from "../services/push-notifications";

describe("push notification registration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as any;
    AsyncStorage.getItem = jest.fn(async () => null) as any;
    AsyncStorage.setItem = jest.fn(async () => undefined) as any;
  });

  it("registers the Expo token and persists the backend preference", async () => {
    const result = await syncPushNotificationToken("GTESTPUBLICKEY");

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/preferences/GTESTPUBLICKEY"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"channel":"push"'),
      }),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "quickex.push-token.v1",
      "ExponentPushToken[abc123]",
    );
  });

  it("skips registration when there is no wallet public key", async () => {
    await expect(syncPushNotificationToken(undefined)).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("serializes a preference payload for the API", async () => {
    await upsertPushNotificationPreference("GTESTPUBLICKEY", "ExponentPushToken[abc123]");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("GTESTPUBLICKEY"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          channel: "push",
          pushToken: "ExponentPushToken[abc123]",
          enabled: true,
          events: null,
        }),
      }),
    );
  });
});