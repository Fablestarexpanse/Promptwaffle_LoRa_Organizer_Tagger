# LoRA Dataset Studio

A modern, cross-platform desktop application for preparing image datasets for AI model training (LoRA, DreamBooth, Textual Inversion, etc.). Built to make the tedious work of tagging thousands of images fast and enjoyable.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Image Management
- **Responsive Grid View** — Auto-fills the window with as many images as fit; resize to see more or fewer columns
- **Auto-Expanding Captions** — Caption text under each image expands to show full content
- **Loading Progress** — Visual overlay with live count when scanning large folders
- **Rating System** — Mark images as Good (green smiley), Bad (red frown), or Needs Edit (wrench)
- **Multi-Select** — Ctrl+Click to select multiple images for batch operations
- **Image Preview** — Double-click or press Enter to view full-size image with zoom

### Tag Editing
- **Inline Editing** — Click caption area under any image to edit tags directly
- **Right Panel Editor** — Detailed tag list with drag-to-reorder and quick delete
- **Search & Replace** — Find and replace text across all tags with regex support
- **Live Highlighting** — See matching text highlighted as you type in search
- **Undo/Redo** — Full history for tag operations (Ctrl+Z / Ctrl+Y)
- **Auto-Save** — Changes saved immediately to .txt caption files

### AI Captioning
- **LM Studio Integration** — Connect to local LM Studio server for vision model captioning
- **JoyCaption Integration** — Auto-installer for JoyCaption with 4-bit quantized model
- **Custom Prompts** — Write your own prompts or use built-in templates
- **Per-Image Generation** — Click sparkle button on any image to generate caption
- **Batch Generation** — Caption all selected images or all uncaptioned images
- **Multiple Modes** — Descriptive, Straightforward, Booru Tags, Training Caption

### Filtering & Navigation
- **Search** — Filter by filename or tag content
- **Caption Status** — Show only captioned or uncaptioned images
- **Rating Filter** — Filter by Good, Bad, or Needs Edit status
- **Keyboard Navigation** — Arrow keys, Home/End, full keyboard-first design

### Export
- **Export Wizard** — Export dataset to folder or ZIP
- **Options** — Filter by caption status, add trigger word, sequential naming
- **Training Ready** — Compatible with Kohya, OneTrainer, and other trainers

## Tech Stack

- **Desktop Framework:** [Tauri 2](https://v2.tauri.app/) (Rust backend, native webview)
- **Frontend:** React 18, TypeScript (strict mode), [Vite](https://vitejs.dev/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (with persist) + [TanStack Query](https://tanstack.com/query/latest)
- **Styling:** Tailwind CSS, dark mode by default
- **Icons:** [Lucide React](https://lucide.dev/)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri backend)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS:
  - **Windows:** WebView2, Visual Studio Build Tools
  - **macOS:** Xcode Command Line Tools
  - **Linux:** Various dev packages (see Tauri docs)

For JoyCaption:
- Python 3.10+ (for auto-installer)
- CUDA-capable GPU recommended (works with CPU but slower)

## Installation

```bash
# Clone the repository
git clone https://github.com/Fablestarexpanse/Joycaption_Mobile_LoRa_Organizer.git
cd Joycaption_Mobile_LoRa_Organizer

# Install dependencies
npm install
```

## Development

```bash
# Run in development mode (hot reload)
npm run tauri dev
```

First Rust compilation takes a few minutes. Subsequent runs are fast.

## Building

```bash
# Build for production
npm run tauri build
```

Installers are output to `src-tauri/target/release/bundle/`.

## Usage

1. **Open a Folder** — Click "Open" and select a folder containing images
2. **View & Edit** — Click any image to select, click caption area to edit tags
3. **AI Caption** — Select AI provider in the right panel, click "Generate Caption"
4. **Filter** — Use the filter bar to find specific images
5. **Export** — Click "Export" to package your dataset

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Navigate | Arrow keys |
| Select | Click / Space |
| Multi-select | Ctrl+Click |
| Open preview | Enter / Double-click |
| Close modal | Escape |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y |
| Help | ? |

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ai/            # AI panel
│   │   ├── editor/        # Tag editor
│   │   ├── grid/          # Image grid
│   │   └── layout/        # App layout
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand state stores
│   ├── lib/               # Tauri API wrappers
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   └── lib.rs         # Plugin registration
│   └── resources/         # Embedded files
└── docs/                  # Documentation
```

## Caption File Format

Caption files use the same name as the image with `.txt` extension:

```
image001.png
image001.txt  ← Contains: "trigger_word, tag1, tag2, detailed description"
```

Tags are comma-separated, compatible with Kohya, OneTrainer, and other trainers.

## AI Integration

### LM Studio
1. Download and run [LM Studio](https://lmstudio.ai/)
2. Load a vision model (e.g., LLaVA, BakLLaVA)
3. Start the local server (default: http://localhost:1234)
4. In LoRA Dataset Studio, select "LM Studio" and click "Test" to connect

### JoyCaption
1. Select "JoyCaption" as the AI provider
2. Click "Install JoyCaption" — automatically downloads model and sets up Python environment
3. Choose a caption mode (Descriptive, Booru, etc.)
4. Generate captions!

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- [Tauri](https://tauri.app/) for the excellent desktop framework
- [JoyCaption](https://huggingface.co/John6666/llama-joycaption-beta-one-hf-llava-nf4) for the captioning model
- The LoRA training community for inspiration
