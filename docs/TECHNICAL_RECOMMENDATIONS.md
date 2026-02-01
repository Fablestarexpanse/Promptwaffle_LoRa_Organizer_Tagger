# LoRA Dataset Studio — Technical Recommendations

This document answers the questions in the Master Project Plan with concrete stack choices, architecture, libraries, and development priorities. Use it as the single source of truth before implementation.

---

## 1. Technology Stack

### Desktop framework: **Tauri 2.x**

**Why Tauri over Electron**

| Concern | Tauri | Electron |
|--------|--------|----------|
| Binary size | ~10–20 MB | ~150 MB+ |
| Memory (idle) | Native webview only | Full Chromium |
| Backend | Rust (safe, fast) | Node.js |
| 10k images, file I/O | Rust is ideal for heavy I/O and caching | Node is fine but heavier |
| Security | No JS in main process by default; explicit IPC | Larger attack surface |
| Cross-platform | Win / macOS / Linux first-class | Same |

For a **fast, beautiful** app that handles **10,000+ images** and stays responsive, Tauri’s smaller footprint and Rust backend for file and thumbnail work make it the better fit. Electron is viable if you prefer the Node/JS ecosystem everywhere; for this spec, Tauri is the recommended choice.

---

### Frontend: **React 18+ with TypeScript**

- **TypeScript:** Strict mode, no `any`. Shared types between frontend and backend (Rust side can mirror critical types or use a small shared schema).
- **React:** Mature ecosystem, excellent virtual-list and grid libraries, familiar for most developers. Good fit for:
  - Resizable panels
  - Complex tag editor and filter UIs
  - Keyboard-first bindings (e.g. `@react-aria` or custom hooks)
- **Build:** **Vite** — fast HMR, simple config, first-class TypeScript. Tauri’s official template uses Vite.

**Alternatives considered:** Vue 3 + TS and Svelte + TS are both viable; React is recommended for ecosystem (virtual scrolling, accessibility, component libs) and hiring/onboarding.

---

### State management: **Zustand**

- **Zustand:** Minimal API, no providers, works great with async and derived state. Fits:
  - Project state (root path, settings)
  - Image list and selection
  - Tag editor (current image tags, batch selection)
  - Filter state (query, saved filters)
  - UI state (panel sizes, modals, sidebar)
- **No Redux:** Would add a lot of boilerplate for little gain at this app size.
- **Server state / async:** Use **TanStack Query (React Query)** for any “fetch from backend” style data (e.g. “list images in folder”, “get caption”) so caching, loading, and refetch are consistent. The “backend” here is Tauri commands (invoke), not a real HTTP server.

**Summary:** Zustand for client/app state, TanStack Query for async Tauri-invoke calls and caching.

---

### Local metadata and persistence

- **Start simple:** `project.json` (and optionally a `index.json` or similar) in `.lora-studio/` for project settings and basic metadata. No DB required for MVP.
- **When scaling to 10k+:** Add **SQLite** for:
  - Thumbnail path / dimensions / rating / flagged
  - Tag index for fast “filter by tag”
  - Optional cache of caption text to avoid re-reading every `.txt` on load
- **Implementation:** Use **tauri-plugin-sql** or a Rust crate (`rusqlite`) in Tauri; expose “get images”, “update rating”, “search by tag” as commands. Frontend stays unaware of SQL.

**Recommendation:** Implement Phase 1–2 with filesystem + JSON only; introduce SQLite in Phase 3 or 4 when you hit performance limits or need advanced filters.

---

### Build and packaging

- **Frontend:** Vite (dev + build). Output: static assets (single SPA or code-split).
- **Desktop:** Tauri CLI (`tauri build`). Produces installers and updater artifacts per platform.
- **Monorepo:** Not required initially. Single repo: `/src` (React), `/src-tauri` (Rust).

---

## 2. Architecture Decisions

### Codebase structure (high level)

```
Joycaption_Mobile_LoRa_Organizer/
├── src/                    # Frontend (React + Vite)
│   ├── components/         # UI components
│   │   ├── layout/         # App shell, panels, toolbar
│   │   ├── grid/            # Image grid, virtual list, thumbnail
│   │   ├── editor/          # Tag editor, tag input, batch bar
│   │   └── ai/              # AI caption panel, progress, templates
│   ├── stores/             # Zustand stores
│   ├── hooks/               # React hooks (keyboard, selection, invoke)
│   ├── lib/                 # Utilities, formatters, filter parser
│   ├── types/               # Shared TS types
│   └── main.tsx / App.tsx
├── src-tauri/              # Tauri (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/        # Invokable commands
│   │   │   ├── project.rs   # open, save, list dirs
│   │   │   ├── images.rs    # list images, read/write caption
│   │   │   ├── thumbnails.rs
│   │   │   ├── lm_studio.rs  # HTTP client to LM Studio
│   │   │   └── joycaption.rs # Python subprocess
│   │   └── utils/           # path sanitization, validation
│   └── Cargo.toml
├── docs/
└── package.json + vite.config.ts + tsconfig.json
```

- **Single entry for frontend:** `main.tsx` mounts React; `App.tsx` composes layout (toolbar, panels, status bar).
- **Backend:** All file system, thumbnails, and AI calls live in Rust. Frontend never touches `fs` or `child_process`; it only calls Tauri commands via `invoke`.

---

### Main process ↔ renderer communication

- **Tauri Invoke:** Frontend calls `invoke('command_name', { payload })` and receives `Promise<Result<T, E>>`. All file access, subprocess, and HTTP to LM Studio happen in Rust.
- **Benefits:** Clear API boundary, type-safe payloads (serialized JSON), no arbitrary code in renderer. No Node in renderer (Tauri uses system webview).
- **Pattern:** One module per domain (e.g. `commands/images.rs`) with multiple commands (e.g. `list_images`, `read_caption`, `write_caption`, `get_thumbnail`). Return small, serializable structs; avoid sending huge blobs (e.g. raw pixels) — send paths or cached thumbnail paths instead.

---

### AI service integrations

- **LM Studio:**  
  - Implement in Rust: HTTP client (e.g. `reqwest`) to `http://localhost:1234` (or configurable base URL).  
  - Send image as base64 in the request body; parse response for caption text.  
  - Handle connection errors and timeouts; return a `Result` so the UI can show “LM Studio unreachable” or “model not found” without crashing.

- **JoyCaption:**  
  - Run as **subprocess** from Rust: `Command::new("python")` (or `joycaption` if installed as CLI) with args (image path, mode, etc.).  
  - Stream stdout/stderr for progress; parse lines if JoyCaption outputs progress (e.g. “1/50”).  
  - Support cancellation: store `Child` handle and kill on user cancel.  
  - Prefer Rust as the only process manager so the frontend only calls `invoke('joycaption_caption', { paths, options })` and subscribes to progress via events or polling (Tauri can emit events to the frontend for progress updates).

- **Caption workflow:**  
  - User selects images → chooses provider + template → clicks Generate.  
  - Frontend calls one command (e.g. `caption_batch`) with image paths and options.  
  - Backend runs LM Studio HTTP and/or JoyCaption subprocess; sends progress events; returns suggested captions.  
  - User reviews in UI; “Accept” triggers `write_caption` for each file. No automatic overwrite without user confirmation.

---

### Virtual scrolling for the image grid

- **Library:** **@tanstack/react-virtual** (headless). It gives you “which indices are in view + overscan”; you render only those items. Works with a grid by computing row/column from index.
- **Approach:**  
  - Each “cell” is a thumbnail. Parent component uses `useVirtualizer` (list or grid).  
  - Thumbnails: Rust command `get_thumbnail(path, size)` returns either a path to a cached file or a data URL. Cache thumbnails on disk in `.lora-studio/thumbnails/` keyed by hash or path + mtime so you don’t regenerate every time.  
  - Load images in the grid via `<img src={thumbnailUrl} />` so the browser handles decoding; virtualizer keeps DOM node count low (e.g. 50–100 cells), so 60fps is achievable.
- **Pitfall to avoid:** Don’t put 10,000 `<img>` tags in the DOM. Virtual scrolling + a bounded window of thumbnail URLs is the right approach.

---

## 3. Key Libraries

### Frontend

| Purpose | Library | Notes |
|--------|--------|--------|
| Virtual list/grid | `@tanstack/react-virtual` | Headless, grid support, small bundle |
| Async / server state | `@tanstack/react-query` | Cache invoke results, loading/error states |
| State | `zustand` | Stores for project, selection, filters, UI |
| Drag and drop | `@dnd-kit/core` (or `react-dnd`) | Reorder tags, optional drag in grid |
| Keyboard / a11y | `@react-aria/interactions` or custom hooks | Focus management, arrow keys, shortcuts |
| Icons | `lucide-react` or `phosphor-react` | Consistent, tree-shakeable |
| Styling | Tailwind CSS or CSS Modules | Tailwind recommended for speed and dark mode |
| Forms / validation | Optional: `zod` + minimal form state | For settings, export wizard, filter builder |

### Backend (Rust)

| Purpose | Crate | Notes |
|--------|--------|--------|
| HTTP client | `reqwest` | LM Studio API calls, async |
| Serialization | `serde`, `serde_json` | All invoke payloads and responses |
| Image decoding | `image` | Thumbnail generation (resize, encode to JPEG/PNG) |
| Subprocess | `tokio::process::Command` | JoyCaption, with cancel via drop or kill |
| Path normalization | `std::path::Path` | Sanitize user paths; stay inside project root |
| Optional DB | `rusqlite` or `tauri-plugin-sql` | When you add SQLite for scale |

### Tooling

- **ESLint:** `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`. Strict rules, no `any`.
- **Prettier:** Format on save; single config at repo root.
- **Testing:** **Vitest** (unit + component); **Testing Library** for React. E2E later: Tauri’s WebDriver or Playwright for critical flows (open project, edit tag, save).

---

### Pitfalls to avoid

1. **Don’t do heavy work in the renderer.** Thumbnail generation, file I/O, and AI calls must stay in Tauri.
2. **Don’t trust paths from the frontend.** Validate and canonicalize in Rust; ensure paths stay under project root (or user-selected folder).
3. **Don’t skip virtual scrolling.** A flat list of 10k images will kill performance; use `@tanstack/react-virtual` from day one for the grid.
4. **Don’t block the main thread in Rust.** Use async (tokio) for LM Studio and for any heavy thumbnail batch; keep UI responsive.
5. **JoyCaption environment.** Ensure Python/venv and dependencies are discoverable (PATH or configurable path); document clearly for users.

---

## 4. Development Priorities

### Minimum viable first milestone (Phase 1 — Foundation)

Goal: **“Open a folder, see a grid of thumbnails, dark theme.”**

1. **Project setup:** Tauri 2 + React + TypeScript + Vite; ESLint + Prettier; folder structure above.
2. **Tauri commands:**  
   - `open_project(root_path)` → validate path, list image files (recursive or one level), return list of `{ path, filename }`.  
   - `get_thumbnail(path, width?)` → generate (or load from cache) and return path or data URL.
3. **Frontend:**  
   - Single window with toolbar (“Open folder”), main content area, status bar.  
   - Image grid with **virtual scrolling**; each cell shows thumbnail + filename.  
   - Dark theme (Tailwind dark or CSS variables).
4. **No tag editing yet.** Just browse. This validates: performance of thumbnail + virtual scroll, and that IPC and project “open” flow work.

Deliverable: User selects a dataset folder → app lists images → scrolls smoothly through hundreds/thousands of thumbnails.

---

### Suggested order of features (aligned with your phases)

- **Phase 1 (Foundation):** As above — open project, grid, thumbnails, dark theme. Optional: basic “project” state (root path) persisted to `project.json`.
- **Phase 2 (Core editing):** Tag editor panel; read/write `.txt` captions; add/remove/reorder tags; auto-save; keyboard nav (arrow keys, Enter, T for tag focus, 1–5 rating); basic filter (e.g. “has tag”, “uncaptioned”).  
  - **Milestone:** User can open project, click image, edit tags, see changes saved to `.txt`.
- **Phase 3 (AI):** LM Studio connection (single image + batch); progress UI; prompt templates; optional JoyCaption subprocess.  
  - **Milestone:** User can generate captions via LM Studio (and optionally JoyCaption), review, accept/reject.
- **Phase 4 (Polish):** Undo/redo, export wizard, settings UI, duplicate finder, tag stats, performance tuning, cross-platform testing, docs.

---

### Where to invest extra effort

1. **Virtual grid + thumbnails:** Get this right early. Smooth 60fps scroll and fast thumbnail cache will define perceived quality.
2. **Keyboard-first and shortcuts:** Implement early so power users don’t depend on mouse; document shortcuts (e.g. `?` for help).
3. **Caption read/write and format:** One source of truth for “trigger word, comma-separated tags”; robust parsing so you never corrupt existing captions.
4. **Error handling and feedback:** “Folder not found”, “LM Studio not running”, “JoyCaption failed” — clear, non-blocking messages so the app feels reliable.

---

## Summary Table

| Decision | Choice |
|----------|--------|
| Desktop | Tauri 2 |
| Frontend | React 18 + TypeScript (strict) + Vite |
| State | Zustand + TanStack Query |
| Virtual grid | @tanstack/react-virtual |
| Styling | Tailwind CSS (dark default) |
| Local metadata | JSON first; SQLite when scaling |
| IPC | Tauri invoke only; all I/O and AI in Rust |
| LM Studio | Rust HTTP client (reqwest) |
| JoyCaption | Rust subprocess (tokio::process), progress via events |
| Testing | Vitest + Testing Library; E2E later |
| First milestone | Open folder → virtual grid of thumbnails → dark theme |

---

Next step: scaffold the repo with Tauri + React + TypeScript + Vite, add ESLint/Prettier, and implement Phase 1 (open project + image grid + thumbnails) so you have a runnable foundation to build on.
