import type { MeResponse, RegisterInput } from "@bitego/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { fetchMe, registerAccount } from "@/api/auth";
import { ApiRequestError } from "@/api/client";
import { getSupabase } from "@/lib/supabase";

// Who is signed in. Wrap the app in <AuthProvider> and read it with useAuth().
//   status "loading"   checking the saved session / loading the profile
//   status "signedOut" nobody signed in
//   status "signedIn"  `profile` is the user's profile (role, business and its approval status)
//   status "error"     signed in but the server could not be reached (show a retry screen)

type Status = "loading" | "signedOut" | "signedIn" | "error";

type AuthValue = {
  status: Status;
  profile: MeResponse | null;
  errorMessage: string | null;
  notice: string | null; // e.g. "This account is not active", shown on the login screen
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Restore the saved session and follow sign-in / sign-out / token refresh.
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // 2. Refresh tokens only while the app is open.
  useEffect(() => {
    const supabase = getSupabase();
    const apply = (state: AppStateStatus) =>
      state === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
    apply(AppState.currentState);
    const sub = AppState.addEventListener("change", apply);
    return () => sub.remove();
  }, []);

  // 3. Load our profile (role, business status) whenever the signed-in user changes.
  const loadProfile = useCallback(async () => {
    setProfileFailed(false);
    try {
      setProfile(await fetchMe());
      setNotice(null);
    } catch (err) {
      const e = err instanceof ApiRequestError ? err : null;
      if (e && (e.status === 401 || e.code === "PROFILE_NOT_FOUND" || e.code === "ACCOUNT_DISABLED")) {
        setNotice(e.status === 401 ? null : e.message);
        await getSupabase().auth.signOut();
        return;
      }
      setErrorMessage(e?.message ?? "Something went wrong. Try again.");
      setProfileFailed(true);
    }
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileFailed(false);
      return;
    }
    void loadProfile();
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
    }
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await registerAccount(input); // throws ApiRequestError with a readable message
      try {
        await signIn(input.email, input.password);
      } catch {
        throw new Error("Your account was created. Please log in.");
      }
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    setNotice(null);
    await getSupabase().auth.signOut();
  }, []);

  const status: Status = !sessionReady
    ? "loading"
    : !session
      ? "signedOut"
      : profile
        ? "signedIn"
        : profileFailed
          ? "error"
          : "loading";

  const value = useMemo<AuthValue>(
    () => ({ status, profile, errorMessage, notice, signIn, register, signOut, reload: loadProfile }),
    [status, profile, errorMessage, notice, signIn, register, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
