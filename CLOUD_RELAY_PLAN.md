# Supabase Cloud Relay for Wynter Code Mobile

## Goal
Add **optional** cloud relay so mobile can connect to desktop from anywhere, while keeping local WiFi as fallback.

## Key Concept: The Relay

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE REALTIME                        │
│                    (WebSocket Relay)                        │
└─────────────────────────────────────────────────────────────┘
        ▲                                       ▲
        │ WebSocket                   WebSocket │
        │ subscribe +                 subscribe │
        │ broadcast                   + listen  │
        ▼                                       ▼
┌───────────────┐                     ┌───────────────┐
│  Desktop App  │                     │  Mobile App   │
│ (anywhere)    │                     │ (anywhere)    │
└───────────────┘                     └───────────────┘
```

**How it works:**
1. Desktop connects to Supabase Realtime channel (e.g., `user:abc123`)
2. Mobile connects to same channel
3. Desktop broadcasts: workspace changes, issue updates, autobuild status
4. Mobile receives broadcasts instantly
5. Mobile sends commands (create issue, start autobuild) → Desktop receives

**No local WiFi needed** - both apps talk through the cloud relay.

---

## Desktop: Optional Setting in Mobile Companion Tab

### New UI in Settings > Mobile Companion
```
┌────────────────────────────────────────────┐
│ Connection Mode                            │
│ ○ Local WiFi (current)                     │
│ ● Cloud Relay (Supabase)                   │
│                                            │
│ Supabase URL: [_______________________]    │
│ Supabase Key: [_______________________]    │
│                                            │
│ Status: Connected to relay ✓              │
└────────────────────────────────────────────┘
```

- If Supabase not configured → local WiFi only (current behavior)
- If Supabase configured → cloud relay enabled
- Can toggle between modes

---

## Implementation Plan

### Phase 1: Database Schema (Supabase)
Create tables for persistent sync:
- `workspaces`, `projects`, `issues`, `kanban_tasks`, etc.
- Enable Realtime on all tables

### Phase 2: Desktop - Add Cloud Relay (Optional)
**Files to modify:**
| File | Changes |
|------|---------|
| `src/stores/mobileApiStore.ts` | Add `cloudRelayEnabled`, `supabaseUrl`, `supabaseKey` |
| `src/components/settings/MobileCompanionTab.tsx` | Add Supabase config UI |
| `src-tauri/src/supabase_relay.rs` | **NEW** - Connect to Supabase Realtime, broadcast updates |
| `src-tauri/src/lib.rs` | Register relay commands |

**Relay behavior:**
1. On enable → connect to Supabase Realtime channel
2. On workspace/project/issue change → broadcast to channel
3. On autobuild status change → broadcast to channel
4. Listen for mobile commands → execute locally

### Phase 3: Mobile - Add Cloud Relay Support
**Files to modify:**
| File | Changes |
|------|---------|
| `src/lib/supabase.ts` | **NEW** - Supabase client |
| `src/stores/connectionStore.ts` | Add cloud relay connection state |
| `src/api/supabaseRelay.ts` | **NEW** - Subscribe to relay channel, receive broadcasts |
| `src/screens/ConnectScreen.tsx` | Add option: "Connect via Cloud" |

**Connection flow:**
1. User enters Supabase URL + Key (or scans QR from desktop)
2. Mobile connects to Supabase Realtime channel
3. Subscribes to broadcasts from desktop
4. Can send commands back through channel

### Phase 4: Keep Local WiFi Working
- Local WiFi remains the **default**
- Cloud relay is **opt-in** via settings
- Both can work simultaneously (desktop broadcasts to both)

---

## Realtime Channel Messages

### Desktop → Mobile (broadcasts)
```typescript
// Workspace update
{ type: 'workspace_update', action: 'created' | 'updated' | 'deleted', data: Workspace }

// Project update
{ type: 'project_update', action: 'created' | 'updated' | 'deleted', data: Project }

// Issue update
{ type: 'issue_update', action: 'created' | 'updated' | 'closed', data: Issue }

// AutoBuild status
{ type: 'autobuild_status', project_id: string, status: AutoBuildStatus }

// Kanban update
{ type: 'kanban_update', workspace_id: string, action: string, data: KanbanTask }
```

### Mobile → Desktop (commands)
```typescript
// Create issue
{ type: 'create_issue', project_id: string, title: string, description?: string }

// Start autobuild
{ type: 'autobuild_start', project_id: string }

// Add to queue
{ type: 'autobuild_queue', project_id: string, issue_id: string }
```

---

## Files Summary

### Desktop (New)
- `src-tauri/src/supabase_relay.rs` - Realtime connection + broadcast
- `src/components/settings/CloudRelaySettings.tsx` - Config UI

### Desktop (Modified)
- `src/stores/mobileApiStore.ts` - Add cloud relay state
- `src/components/settings/MobileCompanionTab.tsx` - Add cloud relay toggle
- `src-tauri/Cargo.toml` - Add `reqwest`, `tokio-tungstenite` for WebSocket

### Mobile (New)
- `src/lib/supabase.ts` - Supabase client
- `src/api/supabaseRelay.ts` - Relay subscription manager

### Mobile (Modified)
- `src/stores/connectionStore.ts` - Add cloud connection mode
- `src/screens/ConnectScreen.tsx` - Add cloud connect option
- `package.json` - Add `@supabase/supabase-js`

---

## Implementation Order

1. Create Supabase project + tables (you do this)
2. Desktop: Add Supabase config to settings UI
3. Desktop: Implement `supabase_relay.rs` - connect + broadcast
4. Mobile: Add Supabase client + relay subscription
5. Mobile: Add cloud connect option to connection screen
6. Test: Desktop broadcasts, mobile receives
7. Test: Mobile sends commands, desktop executes

---

## Supabase Schema (SQL)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#89b4fa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issues (Beads)
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'deferred')),
  issue_type TEXT NOT NULL,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE(project_id, local_id)
);

-- AutoBuild Status
CREATE TABLE autobuild_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('stopped', 'running', 'paused', 'idle', 'error')),
  current_issue_id UUID REFERENCES issues(id),
  progress SMALLINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kanban Tasks
CREATE TABLE kanban_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'doing', 'mvp', 'polished')),
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 0 AND 4),
  sort_order INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  favicon_url TEXT,
  monthly_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookmarks
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  favicon_url TEXT,
  collection_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE autobuild_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users access own workspaces" ON workspaces FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own issues" ON issues FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own autobuild" ON autobuild_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own kanban" ON kanban_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own subscriptions" ON subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own bookmarks" ON bookmarks FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE issues;
ALTER PUBLICATION supabase_realtime ADD TABLE autobuild_status;
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_tasks;
```
