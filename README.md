# ✈️ Logbook

A personal flight logbook mobile app built with React Native, Expo, and TypeScript. Log your flights, visualise your routes on a globe, generate monthly recaps, and share your travel story.

## Features

- 📋 **Flight Logbook** — Add, view, and manage all your flights
- 🌍 **Globe View** — Visualise your flight routes on an interactive 3D globe
- 🛂 **Passport** — Track the countries and airports you've visited
- 📅 **Monthly Recap** — Auto-generated monthly summaries with stats
- 📤 **Share Cards** — Generate and share beautiful flight story cards
- 📲 **Wallet Import** — Import flights from Apple Wallet boarding passes
- 🔐 **Authentication** — Sign in with Google or Apple

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | Expo ~54 / React Native 0.81.5 |
| Language | TypeScript ~5.9 |
| Router | Expo Router v6 (file-based) |
| State / Data Fetching | TanStack React Query v5 |
| Backend | Express v5 (Node.js, via `tsx`) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod + drizzle-zod |
| Auth | Google Sign-In + Apple Authentication |
| Animations | React Native Reanimated v4 |

## Project Structure

```
├── app/                  # Expo Router screens
│   ├── (tabs)/           # Bottom tab screens (Home, Flights, Profile)
│   ├── add-flight.tsx    # Add a new flight
│   ├── auth.tsx          # Authentication screen
│   ├── passport.tsx      # Passport / country tracker
│   ├── monthly-recap.tsx # Monthly recap screen
│   ├── share.tsx         # Share a flight card
│   └── wallet-import.tsx # Import from Apple Wallet
├── components/           # Reusable UI components
├── context/              # React contexts (flights, user, theme)
├── server/               # Express backend (routes, storage)
├── shared/               # Shared types and DB schema (Drizzle)
├── lib/                  # Query client, rate limiter
├── utils/                # Utility helpers
└── constants/            # App-wide constants (colours, etc.)
```

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/dmarques00000-design/flighttracker.git
cd flighttracker

# Install dependencies
npm install

# Push the database schema
npm run db:push

# Start both the Expo app and the backend server
npm run dev
```

The `dev` script runs the Expo client and the Express server concurrently.

### Individual Commands

```bash
npm run expo:dev      # Start Expo only
npm run server:dev    # Start Express backend only
npm run server:build  # Bundle the server for production
npm run server:prod   # Run the production server build
npm run lint          # Lint the project
npm run lint:fix      # Auto-fix lint issues
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
