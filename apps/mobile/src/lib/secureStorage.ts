import * as SecureStore from "expo-secure-store";

// Supabase keeps the login session (tokens) in this storage so the user stays signed in.
// SecureStore encrypts the data using the phone's keystore, but each value is limited to about
// 2 KB and a session is larger, so the value is split into chunks.
const CHUNK_SIZE = 1800;
const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // incomplete data: treat as signed out
      value += part;
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    for (let i = chunks.length; i < previous; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
