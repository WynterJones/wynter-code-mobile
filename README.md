# Wynter Code Mobile

Mobile companion app for [Wynter Code](https://github.com/wyntercode/wynter-code) - control your AI coding assistant from your phone.

## Features

### Core
- **Beads Issue Tracker** - View, create, and manage issues from anywhere
- **Auto-Build Monitor** - Watch build progress in real-time with worker status
- **Chat Sessions** - Continue conversations with Claude and approve tool calls
- **QR Code Pairing** - Quick and secure connection to your desktop

### Manage
- **New Project** - Create projects from templates (AI, frontend, mobile, etc.)
- **Workspaces** - View and switch between workspaces
- **The Board** - Kanban board with 4 columns (Backlog, Doing, MVP, Polished)
- **Docs** - Access project documentation
- **Farmwork** - Codebase analysis and farming tasks

### Tools
- **Live Preview** - Start dev servers and preview on device
- **Netlify Deploy** - Deploy projects to Netlify

### Observe
- **Overwatch** - Monitor services (Railway, Netlify, Plausible, Sentry)
- **Subscriptions** - Track SaaS subscriptions and costs
- **Bookmarks** - Manage project bookmarks and collections

## Screenshots

*Coming soon*

## Installation

### TestFlight (Recommended)

Join our TestFlight beta for automatic updates:

1. Install [TestFlight](https://apps.apple.com/app/testflight/id899247664) from the App Store
2. Click [Join Beta](#) (link coming soon)
3. Open Wynter Code Mobile from TestFlight

### Building from Source

```bash
# Clone the repository
git clone https://github.com/wyntercode/wynter-code-mobile.git
cd wynter-code-mobile

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios
```

## Testing on Physical Device

### Option 1: EAS Build (Recommended)

Build and install a development client on your device:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for your device (requires Apple Developer account)
eas build --profile development --platform ios

# Once built, install via the link provided by EAS
# Then start the dev server:
npx expo start --dev-client
```

Scan the QR code with your phone's camera - it opens in the installed dev build.

### Option 2: Direct Device Build

If your device is connected via USB:

```bash
# Prebuild native project
npx expo prebuild --clean

# Run directly on connected device
npx expo run:ios --device
```

### Option 3: Simulator Only

```bash
# Build for simulator
eas build --profile development-simulator --platform ios

# Or run directly
npx expo run:ios
```

## Connecting to Desktop

1. Open Wynter Code on your desktop
2. Go to **Settings > Mobile Companion**
3. Click **Enable Mobile API**
4. Click **Generate Pairing Code**
5. On your phone, tap **Scan QR Code** or enter the 6-digit code manually

## Requirements

- **iOS**: 15.0 or later
- **Desktop**: Wynter Code with Mobile Companion enabled
- **Network**: Both devices must be on the same local network

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- Xcode 15+ (for iOS builds)
- EAS CLI (`npm install -g eas-cli`)
- Apple Developer account (for device testing)

### Project Structure

```
wynter-code-mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Projects tab
│   │   ├── issues.tsx     # Beads issues tab
│   │   ├── chat.tsx       # Chat sessions tab
│   │   └── autobuild.tsx  # Auto-build monitor tab
│   ├── board.tsx          # Kanban board screen
│   ├── bookmarks.tsx      # Bookmarks management
│   ├── docs.tsx           # Documentation viewer
│   ├── farmwork.tsx       # Farmwork tasks
│   ├── live-preview.tsx   # Dev server preview
│   ├── menu.tsx           # Drawer menu
│   ├── modal.tsx          # Connection/pairing modal
│   ├── netlify-deploy.tsx # Netlify deployments
│   ├── new-project.tsx    # Project creation
│   ├── overwatch.tsx      # Service monitoring
│   ├── subscriptions.tsx  # Subscription tracker
│   ├── workspace-board.tsx # Workspace management
│   └── _layout.tsx        # Root layout
├── src/
│   ├── api/               # API client and hooks
│   │   ├── client.ts      # REST API client
│   │   ├── hooks.ts       # React Query hooks
│   │   └── websocket.ts   # WebSocket manager
│   ├── components/        # Shared components
│   ├── stores/            # Zustand stores
│   │   ├── connectionStore.ts
│   │   ├── projectStore.ts
│   │   └── autoBuildStore.ts
│   ├── theme/             # Colors and spacing
│   └── types/             # TypeScript types
├── assets/                # Images and fonts
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
└── release.sh             # Release automation script
```

### Commands

```bash
# Development
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npx expo start --dev-client  # Start with dev client (for device)

# Type checking
npx tsc --noEmit

# Building
eas build --profile development --platform ios      # Dev build for device
eas build --profile development-simulator --platform ios  # Dev build for simulator
eas build --profile preview --platform ios          # Internal testing build
eas build --profile production --platform ios       # Production build

# Release
./release.sh testflight   # Build and submit to TestFlight
./release.sh preview      # Build for internal testing
./release.sh release      # Create GitHub release draft
./release.sh bump patch   # Bump version number
./release.sh full         # Full release workflow
```

## Release Process

### First-Time Setup

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo:
   ```bash
   eas login
   ```

3. Configure your Apple Developer credentials:
   ```bash
   eas credentials
   ```

4. Set up App Store Connect:
   - Create an App ID in Apple Developer Portal
   - Create an app in App Store Connect
   - Get your ASC App ID from App Store Connect

5. Set environment variables (or use `.env`):
   ```bash
   export APPLE_ID="your@email.com"
   export ASC_APP_ID="1234567890"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```

### Creating a Release

```bash
# Option 1: Full automated release
./release.sh full

# Option 2: Step by step
./release.sh bump patch      # Bump version
./release.sh testflight      # Build and submit to TestFlight
./release.sh release         # Create GitHub release
```

### Manual Build

If you prefer to build manually:

```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Or build and submit in one command
eas build --platform ios --profile production --auto-submit
```

## Architecture

### State Management

- **Zustand** for global state (connection, projects, chat, etc.)
- **React Query** for server state and caching with optimistic updates
- **WebSocket** for real-time updates

### Real-Time Updates

The app connects to the desktop via WebSocket for live updates:

- **BeadsUpdate** - Issue changes (created, updated, closed, deleted)
- **AutoBuildUpdate** - Build status, worker progress, logs
- **ChatStream** - Streaming responses from Claude
- **ToolCall** - Tool call approval requests
- **KanbanUpdate** - Kanban task changes (created, updated, moved, deleted)
- **WorkspaceUpdate** - Workspace changes
- **ProjectUpdate** - Project changes
- **SubscriptionUpdate** - Subscription changes
- **BookmarkUpdate** - Bookmark changes

### API Endpoints

The mobile app communicates with the desktop via a REST API:

```
# Pairing
POST /api/v1/pair                          # Pair with 6-digit code

# Projects & Beads
GET  /api/v1/projects/:id/beads            # List issues
POST /api/v1/projects/:id/beads            # Create issue
PATCH /api/v1/projects/:id/beads/:id       # Update issue
DELETE /api/v1/projects/:id/beads/:id      # Delete issue

# Chat Sessions
GET  /api/v1/projects/:id/sessions         # List sessions
POST /api/v1/projects/:id/sessions         # Create session
GET  /api/v1/sessions/:id/messages         # Get messages

# Auto-Build
GET  /api/v1/projects/:id/autobuild/status # Get build status
POST /api/v1/projects/:id/autobuild/start  # Start build
POST /api/v1/projects/:id/autobuild/stop   # Stop build

# Kanban
GET    /api/v1/kanban/:workspace_id                    # List tasks
POST   /api/v1/kanban/:workspace_id/tasks              # Create task
PATCH  /api/v1/kanban/:workspace_id/tasks/:id          # Update task
DELETE /api/v1/kanban/:workspace_id/tasks/:id          # Delete task
POST   /api/v1/kanban/:workspace_id/tasks/:id/move     # Move task

# Subscriptions
GET    /api/v1/subscriptions                           # List subscriptions
POST   /api/v1/subscriptions                           # Create subscription
PATCH  /api/v1/subscriptions/:id                       # Update subscription
DELETE /api/v1/subscriptions/:id                       # Delete subscription

# Bookmarks
GET    /api/v1/bookmarks                               # List bookmarks
POST   /api/v1/bookmarks                               # Create bookmark
PATCH  /api/v1/bookmarks/:id                           # Update bookmark
DELETE /api/v1/bookmarks/:id                           # Delete bookmark

# WebSocket
WS /api/v1/ws?token=...                    # Real-time updates
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type checking: `npx tsc --noEmit`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Wynter Code](https://github.com/WynterJones/wynter-code) - Desktop application
- [Wynter Code Relay](https://github.com/WynterJones/wynter-code-relay) - Relay server for remote connectivity
