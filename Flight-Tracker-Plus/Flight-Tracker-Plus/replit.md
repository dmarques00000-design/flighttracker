# Logbook - Replit Project Guide

## Overview

Logbook is a mobile-first flight tracking application built with Expo (React Native). Users can log their flights, view statistics (total miles, CO2, flight time), and share visual summaries of their travel history. The app uses a client-server architecture where the React Native frontend communicates with an Express backend for flight data lookup, while flight records are stored locally on the device using AsyncStorage.

Key features:
- Add flights by flight code and date (with auto-lookup via backend)
- View flight history and per-flight details
- Dashboard with stats (miles, CO2, flight time, rank percentile)
- Year/all-time filtering of statistics
- Share a "Story Card" visual summary of travel stats

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK ~54 with Expo Router v6 for file-based navigation
- **Navigation structure**: Tab-based layout (`app/(tabs)/`) with stack screens for add-flight (sheet modal), flight detail, and share modal
- **State management**: React Context (`context/flights.tsx`) handles all flight data, stats computation, and AsyncStorage persistence — no Redux or Zustand
- **Data fetching**: TanStack React Query is set up (`lib/query-client.ts`) for server communication, though most data lives locally
- **Local storage**: `@react-native-async-storage/async-storage` stores the flights array under the key `@logbook_flights`
- **Styling**: All dark-theme with a custom color palette defined in `constants/colors.ts`; uses `expo-linear-gradient`, `expo-blur`, and `expo-glass-effect` for visual effects
- **Animations**: `react-native-reanimated` with `FadeInDown`/`FadeIn` entry animations throughout
- **Fonts**: DM Sans (Regular, Medium, Bold) via `@expo-google-fonts/dm-sans`
- **Sharing**: `react-native-view-shot` captures a `StoryCard` component as an image, then shares via native share sheet

### Backend (Express)

- **Server**: Express 5 running in `server/index.ts`
- **Single route**: `GET /api/flights/lookup?code=XX&date=YYYY-MM-DD` — looks up flight data using built-in static data in `server/storage.ts`
- **Flight data**: The storage module contains hardcoded airline and airport lookup tables; it generates deterministic but realistic-looking flight data (duration, distance, CO2) from IATA codes — no external flight API is used
- **CORS**: Configured to allow Replit dev/deployment domains and localhost origins
- **Static serving**: In production, the server also serves the Expo web static build

### Database

- **Schema**: `shared/schema.ts` defines a `users` table via Drizzle ORM with PostgreSQL dialect
- **Current usage**: The users table exists but is **not actively used** by the app — all flight data is stored client-side in AsyncStorage
- **Migration**: Drizzle Kit is configured (`drizzle.config.ts`) pointing to `DATABASE_URL`; run `npm run db:push` to apply schema

### Build & Deployment

- **Dev**: `npm run expo:dev` (Expo Metro bundler) + `npm run server:dev` (tsx watch for Express)
- **Production**: `npm run expo:static:build` builds the Expo web bundle, then `npm run server:build` bundles Express with esbuild; both served together
- **Environment**: `EXPO_PUBLIC_DOMAIN` must be set so the mobile client knows where to reach the API; the build script auto-detects Replit domain variables

## External Dependencies

| Dependency | Purpose |
|---|---|
| `expo` / `expo-router` | Core mobile framework and file-based navigation |
| `@tanstack/react-query` | Server state management and API request handling |
| `@react-native-async-storage/async-storage` | Local persistence for flight records |
| `react-native-reanimated` | Animations |
| `expo-blur` / `expo-glass-effect` | UI visual effects (frosted glass, blur) |
| `expo-linear-gradient` | Gradient backgrounds |
| `expo-haptics` | Haptic feedback on interactions |
| `expo-image-picker` | (Imported, available for future use) |
| `react-native-view-shot` | Capture StoryCard as image for sharing |
| `drizzle-orm` + `drizzle-zod` | ORM for PostgreSQL schema definition and validation |
| `pg` | PostgreSQL client for Node.js backend |
| `express` | Backend HTTP server |
| `@expo-google-fonts/dm-sans` | Typography |
| `react-native-gesture-handler` | Gesture support |
| `react-native-keyboard-controller` | Keyboard-aware scroll behavior |
| `react-native-svg` | SVG rendering |
| `expo-location` | (Available, not actively used) |

### Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (for Drizzle/backend)
- `EXPO_PUBLIC_DOMAIN` — Domain/host for the API server, consumed by the mobile client to construct API URLs
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` / `REPLIT_INTERNAL_APP_DOMAIN` — Auto-set by Replit, used for CORS and build domain detection