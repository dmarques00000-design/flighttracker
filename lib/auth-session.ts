import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_SESSION_KEY = "@flighttracker_auth_session";

export async function getAuthSession(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_SESSION_KEY);
}

export async function setAuthSession(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_SESSION_KEY, token);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
