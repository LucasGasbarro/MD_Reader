# 📖 MD.Reader

A lightweight, browser-based Markdown file reader. Open any local folder, browse `.md` files in a tree view, and read them with beautiful GitHub-flavored rendering — no server, no build step, no install.

## ✨ Features

- **📂 Local Folder Navigation** — Open any folder from your machine using the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Browse files and subfolders in a collapsible tree sidebar.
- **📝 GitHub-Flavored Markdown** — Full GFM rendering powered by [Marked.js](https://marked.js.org/), including tables, task lists, blockquotes, and more.
- **🎨 Syntax Highlighting** — Code blocks are highlighted automatically with [highlight.js](https://highlightjs.org/), supporting 190+ languages.
- **🗂️ Table of Contents** — Auto-generated from headings with scroll spy to track your reading position.
- **💬 Comments** — Add comments to any file, optionally pinned to selected text. Comments are saved per-file in `localStorage`.
- **🌗 Dark / Light Theme** — Toggle between themes with one click. Your preference is remembered across sessions.
- **🔍 File Filter** — Quickly filter files by name in the sidebar search box.
- **🔄 Session Persistence** — Automatically remembers and restores your last opened folder via IndexedDB.
- **⚡ Zero Dependencies** — Pure HTML, CSS, and JavaScript. No frameworks, no bundlers, no `node_modules`.

## 🚀 Getting Started

### Option 1 — Open directly

Simply open `index.html` in a modern browser (Chrome, Edge, or any Chromium-based browser that supports the File System Access API).

### Option 2 — Serve locally

Use any static file server:

```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .
```

Then navigate to `http://localhost:8000`.

### Usage

1. Click **Open Folder** and select a directory containing `.md` files.
2. Browse the file tree in the sidebar — folders are collapsible, and you can filter by name.
3. Click any file to render it in the main content area.
4. Use the **Table of Contents** panel on the right to jump between sections.
5. Select text and click the 💬 button to add a comment pinned to that passage.

## 🖼️ Project Structure

```
MD.Reader/
├── index.html   # App shell and layout
├── app.js       # Application logic (folder reading, rendering, comments, TOC)
├── style.css    # Full styling with light/dark theme support
└── README.md
```

## 🌐 Browser Compatibility

MD.Reader relies on the **File System Access API** (`showDirectoryPicker`), which is currently supported in:

| Browser | Supported |
|---------|-----------|
| Chrome 86+ | ✅ |
| Edge 86+ | ✅ |
| Opera 72+ | ✅ |
| Firefox | ❌ |
| Safari | ❌ |

> **Note:** Firefox and Safari do not support the File System Access API. The app will not be able to open local folders in those browsers.

## 📄 License

This project is open source. Feel free to use, modify, and distribute it.
