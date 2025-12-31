# Wynter Code Mobile

Mobile companion app for [Wynter Code](https://github.com/wyntercode/wynter-code) - control your AI coding assistant from your phone.

## Features

- **Beads Issue Tracker** - View, create, and manage issues from anywhere
- **Auto-Build Monitor** - Watch build progress in real-time with worker status
- **Chat Sessions** - Continue conversations with Claude and approve tool calls
- **QR Code Pairing** - Quick and secure connection to your desktop

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

### Project Structure

```
wynter-code-mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Projects tab
│   │   ├── issues.tsx     # Beads issues tab
│   │   ├── chat.tsx       # Chat sessions tab
│   │   └── autobuild.tsx  # Auto-build monitor tab
│   ├── modal.tsx          # Connection/pairing modal
│   └── _layout.tsx        # Root layout
├── src/
│   ├── api/               # API client and hooks
│   ├── components/        # Shared components
│   ├── stores/            # Zustand stores
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
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator

# Type checking
npx tsc --noEmit

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
- **React Query** for server state and caching
- **WebSocket** for real-time updates

### Real-Time Updates

The app connects to the desktop via WebSocket for live updates:

- **BeadsUpdate** - Issue changes
- **AutoBuildUpdate** - Build status, worker progress, logs
- **ChatStream** - Streaming responses from Claude
- **ToolCall** - Tool call approval requests

### API

The mobile app communicates with the desktop via a REST API:

- `POST /api/v1/pair` - Pair with desktop using 6-digit code
- `GET /api/v1/projects/:id/beads` - List issues
- `GET /api/v1/projects/:id/sessions` - List chat sessions
- `GET /api/v1/projects/:id/autobuild/status` - Get build status
- `WS /api/v1/ws?token=...` - WebSocket for real-time updates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type checking: `npx tsc --noEmit`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Wynter Code](https://github.com/wyntercode/wynter-code) - Desktop application
