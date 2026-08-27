import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { getWalletSession } from "./wallet-session";

const PUSH_TOKEN_STORAGE_KEY = "quickex.push-token.v1";
const PUSH_TOKEN_PUBLIC_KEY_STORAGE_KEY = "quickex.push-token.public-key.v1";

function getApiBaseUrl(): string {
  const baseUrl =
    (globalThis as any)?.API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    "http://localhost:3000";

  return String(baseUrl).replace(/\/$/, "");
}

async function ensureNotificationPermissions(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) return true;

  if (!Notifications.requestPermissionsAsync) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function resolveExpoPushToken(): Promise<string | null> {
  try {
    if (Notifications.getExpoPushTokenAsync) {
      const token = await Notifications.getExpoPushTokenAsync();
      if (token?.data) return token.data;
    }

    if (Notifications.registerForPushNotificationsAsync) {
      const token = await Notifications.registerForPushNotificationsAsync();
      if (token?.data) return token.data;
    }
  } catch {
    return null;
  }

  return null;
}

export async function upsertPushNotificationPreference(
  publicKey: string,
  pushToken: string,
): Promise<boolean> {
  const response = await fetch(
    `${getApiBaseUrl()}/notifications/preferences/${encodeURIComponent(publicKey)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: "push",
        pushToken,
        enabled: true,
        events: null,
      }),
    },
  );

  if (!response.ok) {
    let message = `Push registration failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Ignore invalid JSON payloads and surface the status code instead.
    }
    throw new Error(message);
  }

  return true;
}

export async function syncPushNotificationToken(
  publicKey?: string,
): Promise<boolean> {
  if (!publicKey) return false;

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) return false;

  const token = await resolveExpoPushToken();
  if (!token) return false;

  const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY).catch(
    () => null,
  );
  const previousPublicKey = await AsyncStorage.getItem(
    PUSH_TOKEN_PUBLIC_KEY_STORAGE_KEY,
  ).catch(() => null);

  if (previousToken === token && previousPublicKey === publicKey) {
    return true;
  }

  await upsertPushNotificationPreference(publicKey, token);
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  await AsyncStorage.setItem(PUSH_TOKEN_PUBLIC_KEY_STORAGE_KEY, publicKey);

  return true;
}

export async function syncPushNotificationTokenForActiveWallet(): Promise<boolean> {
  const walletSession = await getWalletSession();
  if (!walletSession?.publicKey) return false;

  return syncPushNotificationToken(walletSession.publicKey);
}