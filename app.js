(() => {
  "use strict";

  // ===== DOM references =====
  const btnOpenFolder = document.getElementById("btn-open-folder");
  const btnTheme = document.getElementById("btn-theme");
  const iconSun = document.getElementById("icon-sun");
  const iconMoon = document.getElementById("icon-moon");
  const folderNameEl = document.getElementById("folder-name");
  const searchInput = document.getElementById("search-input");
  const fileTreeEl = document.getElementById("file-tree");
  const emptyStateEl = document.getElementById("empty-state");
  const markdownBody = document.getElementById("markdown-body");
  const tocNav = document.getElementById("toc-nav");
  const contentEl = document.getElementById("content");
  const hljsLight = document.getElementById("hljs-light");
  const hljsDark = document.getElementById("hljs-dark");

  const btnRefresh = document.getElementById("btn-refresh");
  const fabComment = document.getElementById("fab-comment");
  const fabBadge = document.getElementById("fab-badge");
  const commentsDrawer = document.getElementById("comments-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const drawerClose = document.getElementById("drawer-close");
  const commentsList = document.getElementById("comments-list");
  const commentsCount = document.getElementById("comments-count");
  const commentInput = document.getElementById("comment-input");
  const btnAddComment = document.getElementById("btn-add-comment");
  const selectionPreview = document.getElementById("comment-selection-preview");
  const selectionText = document.getElementById("selection-text");
  const selectionClear = document.getElementById("selection-clear");

  // ===== State =====
  let fileEntries = []; // { path, name, handle }
  let folderPaths = []; // all subfolder paths
  let folderTree = {};  // nested folder structure
  let activeFilePath = null;
  let currentDirHandle = null;

  // ===== Theme =====
  function getStoredTheme() {
    return localStorage.getItem("md-reader-theme") || "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("md-reader-theme", theme);
    if (theme === "dark") {
      iconSun.style.display = "none";
      iconMoon.style.display = "inline";
      hljsLight.disabled = true;
      hljsDark.disabled = false;
    } else {
      iconSun.style.display = "inline";
      iconMoon.style.display = "none";
      hljsLight.disabled = false;
      hljsDark.disabled = true;
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
    // Re-highlight if content is shown
    document.querySelectorAll(".markdown-body pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  applyTheme(getStoredTheme());
  btnTheme.addEventListener("click", toggleTheme);

  // ===== Folder Opening =====
  btnOpenFolder.addEventListener("click", openFolder);
  btnRefresh.addEventListener("click", refreshFolder);

  // Persist directory handle in IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("md-reader", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("state");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDirHandle(handle) {
    const db = await openDB();
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(handle, "lastDirHandle");
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  }

  async function loadDirHandle() {
    const db = await openDB();
    const tx = db.transaction("state", "readonly");
    const req = tx.objectStore("state").get("lastDirHandle");
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function openFolder() {
    try {
      const dirHandle = await window.showDirectoryPicker();
      currentDirHandle = dirHandle;
      btnRefresh.style.display = "inline-flex";
      await saveDirHandle(dirHandle);
      await loadDirectory(dirHandle);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error opening folder:", err);
      }
    }
  }

  // Restore last folder on page load
  async function restoreLastFolder() {
    try {
      const handle = await loadDirHandle();
      if (!handle) return;
      // Request permission (browser will prompt if needed)
      const perm = await handle.requestPermission({ mode: "read" });
      if (perm !== "granted") return;
      currentDirHandle = handle;
      btnRefresh.style.display = "inline-flex";
      await loadDirectory(handle);
    } catch (err) {
      console.log("Could not restore last folder:", err.message);
    }
  }

  restoreLastFolder();

  async function refreshFolder() {
    if (!currentDirHandle) return;
    await loadDirectory(currentDirHandle);
    // Re-load the active file if it still exists
    if (activeFilePath) {
      const entry = fileEntries.find((e) => e.path === activeFilePath);
      if (entry) await loadFile(entry);
    }
  }

  async function loadDirectory(dirHandle) {
    folderNameEl.textContent = dirHandle.name;
    fileEntries = [];
    folderPaths = [];
    await readDirectory(dirHandle, "");
    fileEntries.sort((a, b) => a.path.localeCompare(b.path));
    folderPaths.sort();
    buildTree();
    renderTree(searchInput.value.trim());
  }

  async function readDirectory(dirHandle, basePath) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".md")) {
        const path = basePath ? `${basePath}/${entry.name}` : entry.name;
        fileEntries.push({ path, name: entry.name, handle: entry });
      } else if (entry.kind === "directory") {
        const subPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        folderPaths.push(subPath);
        await readDirectory(entry, subPath);
      }
    }
  }

  // ===== Tree Building =====
  function buildTree() {
    folderTree = {};
    // Insert all folder paths first (ensures empty folders exist)
    for (const fp of folderPaths) {
      const parts = fp.split("/");
      let node = folderTree;
      for (const part of parts) {
        if (!node[part]) node[part] = {};
        node = node[part];
      }
    }
    // Insert files
    for (const entry of fileEntries) {
      const parts = entry.path.split("/");
      let node = folderTree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]]) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = entry;
    }
  }

  function renderTree(filter = "") {
    const lowerFilter = filter.toLowerCase();
    fileTreeEl.innerHTML = "";

    const filtered = filter
      ? fileEntries.filter((e) => e.path.toLowerCase().includes(lowerFilter))
      : fileEntries;

    if (filtered.length === 0 && fileEntries.length > 0) {
      fileTreeEl.innerHTML = `<div class="empty-state"><p>No files match "<strong>${escapeHtml(filter)}</strong>"</p></div>`;
      return;
    }

    if (filtered.length === 0) {
      fileTreeEl.appendChild(emptyStateEl);
      return;
    }

    // Rebuild a filtered tree
    const tree = {};
    for (const entry of filtered) {
      const parts = entry.path.split("/");
      let node = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]]) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = entry;
    }

    const fragment = document.createDocumentFragment();
    renderTreeNode(tree, fragment);
    fileTreeEl.appendChild(fragment);
  }

  function renderTreeNode(node, parent) {
    const folders = [];
    const files = [];

    for (const key of Object.keys(node).sort((a, b) => a.localeCompare(b))) {
      const val = node[key];
      if (val && val.handle) {
        files.push({ key, entry: val });
      } else if (typeof val === "object") {
        folders.push({ key, children: val });
      }
    }

    // Render folders first
    for (const { key, children } of folders) {
      const count = countFiles(children);
      const folderDiv = document.createElement("div");
      folderDiv.className = "tree-folder";

      const label = document.createElement("div");
      label.className = "tree-folder-label";
      label.innerHTML = `<span class="chevron">▼</span><span>📁 ${escapeHtml(key)}</span><span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:auto">${count}</span>`;
      label.addEventListener("click", () => {
        folderDiv.classList.toggle("collapsed");
      });

      const childDiv = document.createElement("div");
      childDiv.className = "tree-children";
      renderTreeNode(children, childDiv);

      folderDiv.appendChild(label);
      folderDiv.appendChild(childDiv);
      parent.appendChild(folderDiv);
    }

    // Render files
    for (const { key, entry } of files) {
      const fileDiv = document.createElement("div");
      fileDiv.className = "tree-file";
      if (entry.path === activeFilePath) fileDiv.classList.add("active");
      fileDiv.innerHTML = `<span class="tree-file-icon">📄</span><span class="tree-file-name">${escapeHtml(key)}</span>`;
      fileDiv.title = entry.path;
      fileDiv.addEventListener("click", () => loadFile(entry));
      parent.appendChild(fileDiv);
    }
  }

  function countFiles(node) {
    let n = 0;
    for (const val of Object.values(node)) {
      if (val && val.handle) n++;
      else if (typeof val === "object") n += countFiles(val);
    }
    return n;
  }

  // ===== Search / Filter =====
  searchInput.addEventListener("input", () => {
    renderTree(searchInput.value.trim());
  });

  // ===== File Loading =====
  async function loadFile(entry) {
    try {
      activeFilePath = entry.path;
      const file = await entry.handle.getFile();
      const text = await file.text();

      // Configure marked
      marked.setOptions({
        gfm: true,
        breaks: true,
        highlight: function (code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return hljs.highlightAuto(code).value;
        },
      });

      markdownBody.innerHTML = marked.parse(text);

      // Highlight code blocks that marked didn't catch
      markdownBody.querySelectorAll("pre code").forEach((block) => {
        if (!block.dataset.highlighted) {
          hljs.highlightElement(block);
        }
      });

      // Handle checkboxes
      markdownBody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.disabled = true;
      });

      // Update sidebar active state
      document.querySelectorAll(".tree-file").forEach((el) => {
        el.classList.toggle("active", el.title === entry.path);
      });

      buildTOC();
      renderComments();
      fabComment.style.display = "flex";
      contentEl.scrollTop = 0;
    } catch (err) {
      console.error("Error reading file:", err);
      markdownBody.innerHTML = `<p style="color:red">Error reading file: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ===== Table of Contents =====
  function buildTOC() {
    tocNav.innerHTML = "";
    const headings = markdownBody.querySelectorAll("h1, h2, h3, h4, h5, h6");

    if (headings.length === 0) {
      tocNav.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px;">No headings found.</p>';
      return;
    }

    headings.forEach((heading, idx) => {
      // Generate a unique ID for the heading
      const id = `heading-${idx}`;
      heading.id = id;

      const level = parseInt(heading.tagName.charAt(1), 10);
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = heading.textContent;
      link.setAttribute("data-level", level);
      link.addEventListener("click", (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        // Update active state
        tocNav.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
        link.classList.add("active");
      });

      tocNav.appendChild(link);
    });

    // Scroll spy
    setupScrollSpy(headings);
  }

  function setupScrollSpy(headings) {
    const tocLinks = tocNav.querySelectorAll("a");

    contentEl.addEventListener("scroll", () => {
      let current = 0;
      const scrollPos = contentEl.scrollTop + 80;

      headings.forEach((heading, idx) => {
        if (heading.offsetTop <= scrollPos) {
          current = idx;
        }
      });

      tocLinks.forEach((link) => link.classList.remove("active"));
      if (tocLinks[current]) tocLinks[current].classList.add("active");
    });
  }

  // ===== Comments =====
  const COMMENTS_KEY = "md-reader-comments";
  let pendingSelection = "";

  // Drawer open/close
  fabComment.addEventListener("click", openDrawer);
  drawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  function openDrawer() {
    // Capture any selected text from the markdown body
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && markdownBody.contains(sel.anchorNode)) {
      pendingSelection = sel.toString().trim();
      selectionText.textContent = pendingSelection.length > 200
        ? pendingSelection.slice(0, 200) + "…" : pendingSelection;
      selectionPreview.style.display = "block";
    }
    commentsDrawer.classList.add("open");
    drawerOverlay.classList.add("open");
    commentInput.focus();
  }

  function closeDrawer() {
    commentsDrawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    clearSelection();
  }

  selectionClear.addEventListener("click", clearSelection);

  function clearSelection() {
    pendingSelection = "";
    selectionPreview.style.display = "none";
    selectionText.textContent = "";
  }

  // Capture selection from markdown body
  markdownBody.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && markdownBody.contains(sel.anchorNode)) {
      pendingSelection = sel.toString().trim();
      // If drawer is already open, update the preview
      if (commentsDrawer.classList.contains("open")) {
        selectionText.textContent = pendingSelection.length > 200
          ? pendingSelection.slice(0, 200) + "…" : pendingSelection;
        selectionPreview.style.display = "block";
      }
    }
  });

  function getComments() {
    try {
      return JSON.parse(localStorage.getItem(COMMENTS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveComments(all) {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
  }

  function getFileComments() {
    if (!activeFilePath) return [];
    const all = getComments();
    return all[activeFilePath] || [];
  }

  function updateBadge() {
    const count = getFileComments().length;
    if (count > 0) {
      fabBadge.textContent = count;
      fabBadge.classList.add("visible");
    } else {
      fabBadge.classList.remove("visible");
    }
  }

  function renderComments() {
    const comments = getFileComments();
    commentsCount.textContent = comments.length;
    commentsList.innerHTML = "";
    updateBadge();

    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="no-comments">No comments yet.<br>Select text in the document, then click the 💬 button.</div>';
      return;
    }

    for (const c of comments) {
      const item = document.createElement("div");
      item.className = "comment-item";

      let selectionHtml = "";
      if (c.selection) {
        const truncated = c.selection.length > 120 ? c.selection.slice(0, 120) + "…" : c.selection;
        selectionHtml = `<div class="comment-selection" title="Click to expand">📌 ${escapeHtml(truncated)}</div>`;
      }

      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-date">${escapeHtml(formatDate(c.date))}</span>
          <button class="comment-delete" title="Delete comment">&times;</button>
        </div>
        ${selectionHtml}
        <div class="comment-text">${escapeHtml(c.text)}</div>
      `;
      item.querySelector(".comment-delete").addEventListener("click", () => {
        deleteComment(c.id);
      });
      commentsList.appendChild(item);
    }
  }

  function addComment(text) {
    if (!activeFilePath || !text.trim()) return;
    const all = getComments();
    if (!all[activeFilePath]) all[activeFilePath] = [];
    all[activeFilePath].push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      selection: pendingSelection || null,
      date: new Date().toISOString(),
    });
    saveComments(all);
    clearSelection();
    renderComments();
  }

  function deleteComment(id) {
    const all = getComments();
    if (!all[activeFilePath]) return;
    all[activeFilePath] = all[activeFilePath].filter((c) => c.id !== id);
    if (all[activeFilePath].length === 0) delete all[activeFilePath];
    saveComments(all);
    renderComments();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  btnAddComment.addEventListener("click", () => {
    addComment(commentInput.value);
    commentInput.value = "";
  });

  commentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      addComment(commentInput.value);
      commentInput.value = "";
    }
  });

  // ===== Helpers =====
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
