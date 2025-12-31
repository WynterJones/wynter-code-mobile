# Apple Watch App for Wynter Code - Implementation Plan

## User Requirements
- **Priority**: Auto Build control (start/stop, status, progress)
- **Architecture**: iPhone relay (no standalone needed)
- **Development**: Native Swift/SwiftUI ✅

---

## Current Setup Summary

### Desktop App (wynter-code-site)
- **Tech**: Tauri 2.0 + React 18 + TypeScript
- **Features**: Auto Build, Beads Tracker (issues), Chat with AI, 90+ developer tools
- **API**: REST endpoints at `http://{host}:{port}/api/v1/*`
- **Real-time**: WebSocket at `ws://{host}:{port}/api/v1/ws`

### Mobile App (wynter-code-mobile)
- **Tech**: React Native + Expo + TypeScript
- **Features**: Issues, Auto Build monitoring/control, Chat, Project browsing
- **Connection**: Local network only, token-based auth, QR code pairing
- **State**: Zustand stores + React Query + WebSocket

---

## Feasibility: ✅ Confirmed

- WhatsApp, Telegram have full Watch messaging apps
- watchOS supports HTTP networking, lists, buttons, notifications
- Chat possible via voice dictation (limited for long responses)

---

## Architecture

```
┌─────────────────┐     WatchConnectivity     ┌─────────────────┐
│  Apple Watch    │◄──────────────────────────►│   iPhone App    │
│  (Swift/SwiftUI)│                            │  (React Native) │
└─────────────────┘                            └────────┬────────┘
                                                        │ HTTP/WS
                                                        ▼
                                               ┌─────────────────┐
                                               │  Desktop App    │
                                               │  (Tauri Server) │
                                               └─────────────────┘
```

**Stack**:
- Watch UI: Native Swift + SwiftUI (required - React Native can't build watchOS)
- iPhone Bridge: `react-native-watch-connectivity` package
- Target: watchOS 10+ (Apple Watch Series 4+)

---

## MVP Features: Auto Build Control

1. **Status Display**: Running/Paused/Stopped/Error indicator
2. **Progress Ring**: Visual percentage with phase text
3. **Worker Count**: Number of active workers
4. **Controls**: Start/Pause/Stop buttons
5. **Queue Preview**: Count + list of queued issues

---

## Implementation Plan (MVP: Auto Build Control)

### Phase 1: Project Setup
1. Add watchOS target to Xcode project (in `ios/` folder)
2. Install `react-native-watch-connectivity` package
3. Configure Expo bare workflow for custom native code
4. Set up Watch app bundle ID & capabilities

### Phase 2: WatchConnectivity Bridge (React Native Side)
1. Create native module `WatchBridge.ts`
2. Implement message handlers in `App.tsx` or store
3. Forward Auto Build state to Watch via `sendMessage()`
4. Listen for Watch commands (start/pause/stop)

### Phase 3: Watch App UI (SwiftUI)
1. Create main `AutoBuildView.swift`:
   - Status indicator (Running/Paused/Stopped/Error)
   - Progress ring with percentage
   - Current phase text
   - Worker count
   - Start/Pause/Stop buttons
2. Create `QueueView.swift`:
   - List of queued issues
   - Tap to see issue title
3. Simple navigation between views

### Phase 4: Data Flow
1. Watch requests state → iPhone → Desktop API
2. Desktop responds → iPhone → Watch updates UI
3. Watch sends command → iPhone → Desktop API
4. Implement debouncing for button presses

### Phase 5: Watch Complications (Optional)
1. Circular complication: Build status icon
2. Rectangular: "Building 45% | 3 in queue"

---

## Key Files to Create/Modify

### New Files (Watch Extension)
```
ios/WynterCodeWatch/
├── WynterCodeWatchApp.swift           # App entry point
├── ContentView.swift                   # Main view container
├── Views/
│   ├── AutoBuildView.swift            # Build status & controls
│   └── QueueView.swift                # Queue list
├── Models/
│   └── AutoBuildState.swift           # State model matching RN types
└── WatchConnectivityManager.swift     # iPhone communication
```

### Modified Files (React Native)
```
ios/
├── Podfile                             # Add Watch target dependency
└── WynterCodeMobile.xcodeproj          # Add Watch target

package.json                            # Add react-native-watch-connectivity

src/
├── hooks/
│   └── useWatchConnectivity.ts         # Hook for Watch communication
└── stores/
    └── autoBuildStore.ts               # Add Watch sync logic
```

---

## Data Models (Watch ↔ iPhone)

### Message Types
```swift
// iPhone → Watch
struct AutoBuildUpdate: Codable {
    let status: String        // "running", "paused", "stopped", "idle", "error"
    let phase: String?        // "selecting", "working", "testing", etc.
    let progress: Int         // 0-100
    let workerCount: Int
    let queueCount: Int
    let queue: [QueueItem]
}

struct QueueItem: Codable {
    let id: String
    let title: String
    let type: String          // "bug", "feature", "task"
}

// Watch → iPhone
struct WatchCommand: Codable {
    let action: String        // "start", "pause", "stop"
}
```

---

## Future Enhancements (Post-MVP)

1. **Issues View**: View/filter issues, quick status changes
2. **Notifications**: Build complete, errors, human review needed
3. **Complications**: Watch face widgets showing status
4. **Voice Commands**: "Start the build" via Siri
5. **Chat**: Quick voice-to-text questions

---

## Sources

- [watchOS Developer Documentation](https://developer.apple.com/documentation/watchos-apps)
- [Watch Connectivity Framework](https://developer.apple.com/documentation/watchconnectivity)
- [React Native Watch Connectivity](https://github.com/watch-connectivity/react-native-watch-connectivity)
- [WhatsApp Apple Watch App](https://blog.whatsapp.com/introducing-whatsapp-for-apple-watch)
