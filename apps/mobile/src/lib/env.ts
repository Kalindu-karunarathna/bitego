// Environment values come from apps/mobile/.env (copy .env.example). They are baked into the app
// at build time, so only public values belong here. Restart Expo after changing .env
// (run `npx expo start -c`).
const raw = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

const trimSlash = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

export const env = {
  apiUrl: trimSlash(raw.EXPO_PUBLIC_API_URL),
  supabaseUrl: trimSlash(raw.EXPO_PUBLIC_SUPABASE_URL),
  // The Supabase publishable key (formerly "anon" key). Safe to ship in the app.
  supabaseKey: (raw.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
};

// Human-readable problems with the configuration; an empty list means all good.
export const configProblems: string[] = (() => {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (!value || !value.trim()) problems.push(`${name} is missing`);
  }
  if (env.supabaseUrl) {
    try {
      const url = new URL(env.supabaseUrl);
      if (url.pathname !== "/") {
        problems.push("EXPO_PUBLIC_SUPABASE_URL must be only https://<project>.supabase.co (no path after it)");
      }
    } catch {
      problems.push("EXPO_PUBLIC_SUPABASE_URL is not a valid URL");
    }
  }
  if (env.apiUrl && !/^https?:\/\//.test(env.apiUrl)) {
    problems.push("EXPO_PUBLIC_API_URL must start with http:// or https://");
  }
  return problems;
})();
