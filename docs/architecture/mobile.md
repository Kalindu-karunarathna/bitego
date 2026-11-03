# Mobile app (apps/mobile)

Expo SDK 57 + React Native + Expo Router. Everything in `src/` is imported with the `@/` alias (`@/lib/theme`).

## How screens are chosen

`app/_layout.tsx` wraps the app in `AuthProvider` and uses `Stack.Protected` guards:

| Who | Screens |
| --- | --- |
| Signed out | `(auth)`: login, register, register-customer, register-business |
| CUSTOMER | `(customer)` tabs: discover, reservations, account |
| BUSINESS, status ACTIVE | `(business)` tabs: sell, buy, orders, shop |
| BUSINESS, not ACTIVE | `pending-approval` (Check again / Log out) |
| ADMIN | `admin-notice` (admins use the web dashboard) |

A user can never open a screen of another group. Do not add your own role checks in screens.
To add a screen, create a file in the right folder; to add a tab, also add a `<Tabs.Screen>` line in that folder's `_layout.tsx`.

## Where things live

- `src/lib/env.ts` reads `EXPO_PUBLIC_*` variables and reports mistakes (shown on a "Setup needed" screen).
- `src/lib/supabase.ts` Supabase client. Used only for sign-in and the saved session (stored encrypted with SecureStore, see `secureStorage.ts`). All data goes through our API, never directly to Supabase.
- `src/api/client.ts` `apiFetch(path, { method, body })` adds the login token, 15 s timeout, and turns errors into `ApiRequestError(status, code, message, details)`. Add one file per module next to `auth.ts` (for example `api/listings.ts`).
- `src/features/auth/AuthProvider.tsx` `useAuth()` gives `profile` (role, business and its approval status), `signIn`, `register`, `signOut`, `reload`.
- `src/components/ui.tsx` shared Screen, TextField, Button, ChoiceChips, Card, Banner. `src/lib/theme.ts` colours and spacing.
- `src/components/LocationPicker.tsx` GPS button + map pin (phone). `LocationPicker.web.tsx` is the browser version without the map.
- `src/components/Placeholder.tsx` temporary "coming soon" body. Delete its use when you build the real screen.

## Rules

- Never import `@supabase/supabase-js` in a screen. Use `apiFetch`.
- Validate forms with the schemas in `packages/shared` (same rules as the API).
- Only `EXPO_PUBLIC_*` values go in `.env`, and they are public. Never put the Supabase secret key or database URLs here.
- After changing `.env`, restart with `npx expo start -c`.
- Android maps: Expo Go shows the map without a key. A development or release build needs a Google Maps API key (`android.config.googleMaps.apiKey` in `app.json`) restricted to package `com.bitego.app`.
