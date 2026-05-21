import { nodes, edges, network } from "./network.js";
import {
  getCurrentLang,
  setCurrentLang,
  resetState,
  getUrlMap,
  incrementNextId,
  setActiveNodeId,
  setNextId,
} from "./state.js";
import {
  addSingleNode,
  addNoticeNode,
  expandNode,
  removeNode,
  toggleDetach,
  editNodeTitle,
} from "./nodes.js";
import { searchWikipedia, getRandomWikiURL, clearCache } from "./api.js";
import { showModal, isValidUrl, updatePlaceholder } from "./utils.js";


const ctxMenu = document.createElement("div");
ctxMenu.id = "context-menu";
Object.assign(ctxMenu.style, {
  position: "absolute",
  display: "none",
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#e0e0e0",
  padding: "4px",
  zIndex: 9999,
  borderRadius: "4px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
});
document.body.appendChild(ctxMenu);

const fileUploadInput = document.createElement("input");
fileUploadInput.type = "file";
fileUploadInput.multiple = true;
fileUploadInput.accept = "*/*";
fileUploadInput.style.display = "none";
document.body.appendChild(fileUploadInput);

export function isMenuVisible() {
  return ctxMenu.style.display === "block";
}
export function hideMenu() {
  ctxMenu.style.display = "none";
}

function createMenuItem(html, action) {
  const div = document.createElement("div");
  div.innerHTML = html;
  Object.assign(div.style, {
    padding: "10px 15px",
    cursor: "pointer",
    color: "#e0e0e0",
    borderBottom: "1px solid #333",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });
  div.addEventListener("mouseenter", () => {
    div.style.background = "rgba(52,152,219,0.2)";
    div.style.color = "#fff";
  });
  div.addEventListener("mouseleave", () => {
    div.style.background = "";
    div.style.color = "#e0e0e0";
  });
  div.onclick = () => {
    hideMenu();
    action();
  };
  return div;
}

export function showNodeMenu(x, y, id) {
  ctxMenu.innerHTML = "";
  const node = nodes.get(id);
  const actions = [
    {
      html: '<i class="fas fa-external-link-alt"></i> Open',
      action: () => expandNode(id),
    },
    {
      html: '<i class="fas fa-trash"></i> Delete',
      action: () => removeNode(id),
    },
    {
      html: '<i class="fas fa-unlink"></i> Detach',
      action: () => toggleDetach(id),
    },
  ];
  if (node.type === "web" || node.type === "notice" || node.type === "file") {
    actions.splice(1, 0, {
      html: '<i class="fas fa-edit"></i> Edit Title',
      action: () => editNodeTitle(id),
    });
  }
  actions.forEach((item) =>
    ctxMenu.appendChild(createMenuItem(item.html, item.action)),
  );
  ctxMenu.style.left = x + "px";
  ctxMenu.style.top = y + "px";
  ctxMenu.style.display = "block";
}

export function showCanvasMenu(x, y) {
  ctxMenu.innerHTML = "";
  const rect = document.getElementById("mynetwork").getBoundingClientRect();
  const pos = network.DOMtoCanvas({ x: x - rect.left, y: y - rect.top });

  ctxMenu.appendChild(
    createMenuItem('<i class="fas fa-globe"></i> Add Web Page', () => {
      showModal("Enter URL", "https://").then((url) => {
        if (url && isValidUrl(url)) {
          const nodeType = url.includes("wikipedia.org") ? "wikipedia" : "web";
          if (nodeType === "web") {
            showModal(
              "Enter title for the web page",
              decodeURIComponent(url.split("/").pop() || "Web Page").replace(
                /_/g,
                " ",
              ),
            ).then((title) => {
              if (title !== null)
                addSingleNode(url, pos.x, pos.y, title, nodeType);
            });
          } else {
            addSingleNode(url, pos.x, pos.y, null, nodeType);
          }
        }
      });
    }),
  );
  ctxMenu.appendChild(
    createMenuItem('<i class="fas fa-sticky-note"></i> Add Notice', () => {
      showModal("Enter notice title", "New notice").then((title) => {
        if (title !== null) addNoticeNode(pos.x, pos.y, title || "New notice");
      });
    }),
  );
  ctxMenu.appendChild(
    createMenuItem('<i class="fas fa-file-upload"></i> Upload Files', () =>
      fileUploadInput.click(),
    ),
  );
  ctxMenu.appendChild(
    createMenuItem('<i class="fas fa-trash-alt"></i> Clear Canvas', () =>
      clearCanvas(),
    ),
  );

  ctxMenu.style.left = x + "px";
  ctxMenu.style.top = y + "px";
  ctxMenu.style.display = "block";
}

let searchTimeout,
  currentSearchResults = [],
  selectedResultIndex = -1;

function displaySearchResults(results) {
  const sr = document.getElementById("search-results");
  if (results.length === 0) {
    sr.innerHTML =
      '<div class="search-result-item no-results">No results found</div>';
    sr.style.display = "block";
    return;
  }
  sr.innerHTML = results
    .map(
      (r, i) => `
        <div class="search-result-item ${i === selectedResultIndex ? "selected" : ""}" data-url="${r.url}" data-index="${i}">
            <div class="search-result-title">${r.title}</div>
            <div class="search-result-description">${r.description || ""}</div>
        </div>`,
    )
    .join("");
  sr.style.display = "block";
  selectedResultIndex = -1;
}

function scrollToSelectedResult() {
  if (selectedResultIndex >= 0) {
    const el = document.querySelector(`[data-index="${selectedResultIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
}

function handleSearchResultSelect(url, title) {
  document.getElementById("wiki-search").value = "";
  const sr = document.getElementById("search-results");
  sr.innerHTML = "";
  sr.style.display = "none";
  selectedResultIndex = -1;
  const id = incrementNextId();
  const map = getUrlMap();
  map[url] = id;
  const shortTitle = title.length > 30 ? title.substring(0, 30) + "..." : title;
  nodes.add({
    id,
    label: shortTitle,
    url,
    type: "wikipedia",
    x: Math.random() * 400 - 200,
    y: Math.random() * 400 - 200,
    color: {
      background: "#9b59b6",
      border: "#8e44ad",
      highlight: { background: "#9b59b6", border: "#8e44ad" },
    },
  });
  network.focus(id, {
    scale: 1.2,
    animation: { duration: 500, easingFunction: "easeInOutQuad" },
  });
  expandNode(id);
}

export function clearCanvas() {
  nodes.clear();
  edges.clear();
  resetState();
  clearCache();
  document.getElementById("side-panel").classList.remove("open");
  document.getElementById("panel-iframe").srcdoc = "";
  document.getElementById("panel-title").textContent = "";
  setActiveNodeId(null);
}

function getIconCode(nodeType, filename) {
  if (nodeType === "image") return "\uf03e"; 
  if (nodeType === "video") return "\uf008"; 
  if (nodeType === "audio") return "\uf001";
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "pdf":
      return "\uf1c1"; 
    case "docx":
    case "doc":
      return "\uf1c2"; 
    case "xlsx":
    case "xls":
      return "\uf1c3"; 
    case "fb2":
    case "epub":
      return "\uf02d"; 
    default:
      return "\uf15b";
  }
}

function getNodeColor(nodeType, filename) {
  if (nodeType === "image")
    return {
      background: "#e67e22",
      border: "#d35400",
      highlight: { background: "#e67e22", border: "#d35400" },
    };
  if (nodeType === "video")
    return {
      background: "#fff",
      border: "#e74c3c",
      highlight: { background: "#fff", border: "#e74c3c" },
      font: { color: "#000" },
    };
  if (nodeType === "audio")
    return {
      background: "#fff",
      border: "#9b59b6",
      highlight: { background: "#fff", border: "#9b59b6" },
      font: { color: "#000" },
    };
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "pdf":
      return {
        background: "#fff",
        border: "#e74c3c",
        highlight: { background: "#fff", border: "#e74c3c" },
        font: { color: "#000" },
      };
    case "docx":
    case "doc":
      return {
        background: "#fff",
        border: "#3498db",
        highlight: { background: "#fff", border: "#3498db" },
        font: { color: "#000" },
      };
    case "xlsx":
    case "xls":
      return {
        background: "#fff",
        border: "#27ae60",
        highlight: { background: "#fff", border: "#27ae60" },
        font: { color: "#000" },
      };
    case "fb2":
    case "epub":
      return {
        background: "#fff",
        border: "#f39c12",
        highlight: { background: "#fff", border: "#f39c12" },
        font: { color: "#000" },
      };
    default:
      return {
        background: "#fff",
        border: "#3498db",
        highlight: { background: "#fff", border: "#3498db" },
        font: { color: "#000" },
      };
  }
}

export async function handleFileUpload(file, clientX, clientY) {
  const rect = document.getElementById("mynetwork").getBoundingClientRect();
  const pos = network.DOMtoCanvas({
    x: clientX - rect.left,
    y: clientY - rect.top,
  });

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");

  if (isImage || isVideo || isAudio) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const id = incrementNextId();
      const nodeType = isImage ? "image" : isVideo ? "video" : "audio";
      const label =
        file.name.length > 25 ? file.name.substring(0, 25) + "..." : file.name;
      if (isImage) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const maxSize = 200;
          let w = img.width,
            h = img.height;
          if (w > h) {
            if (w > maxSize) {
              h = (h * maxSize) / w;
              w = maxSize;
            }
          } else {
            if (h > maxSize) {
              w = (w * maxSize) / h;
              h = maxSize;
            }
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const thumb = canvas.toDataURL("image/jpeg", 0.8);
          nodes.add({
            id,
            label: "",
            type: "image",
            fileData: data,
            fileName: file.name,
            fileType: file.type,
            thumbnail: thumb,
            x: pos.x,
            y: pos.y,
            shape: "image",
            image: thumb,
            size: Math.max(w, h) / 10 + 40,
            color: {
              background: "#e67e22",
              border: "#d35400",
              highlight: { background: "#e67e22", border: "#d35400" },
            },
          });
        };
        img.src = data;
      } else {
        const code = isVideo ? "\uf008" : "\uf001";
        const color = isVideo
          ? {
              background: "#fff",
              border: "#e74c3c",
              highlight: { background: "#fff", border: "#e74c3c" },
              font: { color: "#000" },
            }
          : {
              background: "#fff",
              border: "#9b59b6",
              highlight: { background: "#fff", border: "#9b59b6" },
              font: { color: "#000" },
            };
        nodes.add({
          id,
          label,
          type: nodeType,
          fileData: data,
          fileName: file.name,
          fileType: file.type,
          x: pos.x,
          y: pos.y,
          shape: "icon",
          icon: { face: "FontAwesome", code, color: color.border, size: 60 },
          color,
        });
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/convert-file", {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) throw new Error("Conversion failed");
      const { html, error } = await resp.json();
      if (error) throw new Error(error);

      const idNode = incrementNextId();
      const label =
        file.name.length > 25 ? file.name.substring(0, 25) + "..." : file.name;
      const code = getIconCode("file", file.name);
      const color = getNodeColor("file", file.name);

      nodes.add({
        id: idNode,
        label,
        type: "file",
        fileName: file.name,
        fileType: file.type,
        fileData: base64Data,
        htmlContent: html,
        x: pos.x,
        y: pos.y,
        shape: "icon",
        icon: { face: "FontAwesome", code, color: color.border, size: 60 },
        color,
        fixed: { x: true, y: true },
      });
      setTimeout(() => nodes.update({ id: idNode, fixed: false }), 100);
    } catch (error) {
      console.error("File conversion error:", error);
      const idNode = incrementNextId();
      const label = file.name.substring(0, 25) + "...";
      const code = getIconCode("file", file.name);
      const color = getNodeColor("file", file.name);
      nodes.add({
        id: idNode,
        label,
        type: "file",
        fileName: file.name,
        fileType: file.type,
        fileData: base64Data,
        x: pos.x,
        y: pos.y,
        shape: "icon",
        icon: { face: "FontAwesome", code, color: color.border, size: 60 },
        color,
        fixed: { x: true, y: true },
      });
      setTimeout(() => nodes.update({ id: idNode, fixed: false }), 100);
    }
  };
  reader.readAsDataURL(file);
}

export function initUI() {
  updatePlaceholder();
  const btnRand = document.getElementById("btn-random");
  const btnSave = document.getElementById("btn-save");
  const btnLoad = document.getElementById("btn-load");
  const fileInput = document.getElementById("file-input");
  const btnClose = document.getElementById("btn-close");
  const langSelect = document.getElementById("lang-select");
  const searchInput = document.getElementById("wiki-search");
  const searchResults = document.getElementById("search-results");

  btnRand.addEventListener("click", async () => {
    try {
      const randomUrl = await getRandomWikiURL();
      nodes.clear();
      edges.clear();
      resetState();
      clearCache();
      const rootId = incrementNextId();
      const map = getUrlMap();
      map[randomUrl] = rootId;
      nodes.add({
        id: rootId,
        label: "...",
        url: randomUrl,
        type: "wikipedia",
        color: {
          background: "#9b59b6",
          border: "#8e44ad",
          highlight: { background: "#9b59b6", border: "#8e44ad" },
        },
      });
      await expandNode(rootId);
    } catch (error) {
      console.log("Random error:", error);
    }
  });

  btnSave.addEventListener("click", () => {
    const positions = network.getPositions();
    const graph = {
      nodes: nodes.get().map((node) => {
        const pos = positions[node.id] || { x: node.x || 0, y: node.y || 0 };
        const n = { ...node, x: pos.x, y: pos.y };
        delete n.detached;
        delete n.detachedEdges;
        return n;
      }),
      edges: edges.get().map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        color: e.color,
        width: e.width,
      })),
      metadata: {
        savedAt: new Date().toISOString(),
        version: "3.2",
        nodeCount: nodes.length,
        edgeCount: edges.length,
        language: getCurrentLang(),
        viewPosition: network.getViewPosition(),
        scale: network.getScale(),
      },
    };
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wiki-graph-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  btnLoad.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.nodes || !data.edges) return;
      nodes.clear();
      edges.clear();
      resetState();
      clearCache();
      if (data.metadata?.language) {
        setCurrentLang(data.metadata.language);
        langSelect.value = getCurrentLang();
        updatePlaceholder();
      }
      let maxId = 0;
      data.nodes.forEach((n) => {
        maxId = Math.max(maxId, n.id);
      });
      setNextId(maxId + 1);
      const map = getUrlMap();
      data.nodes.forEach((n) => {
        if (n.url && (n.type === "wikipedia" || n.type === "web"))
          map[n.url] = n.id;
        nodes.add({ ...n, fixed: true, physics: false });
      });
      edges.add(data.edges);
      setTimeout(() => {
        network.setOptions({
          layout: {
            randomSeed: undefined,
            improvedLayout: false,
            hierarchical: false,
          },
          physics: false,
        });
        network.redraw();
        setTimeout(() => {
          if (data.metadata?.viewPosition && data.metadata?.scale) {
            network.moveTo({
              position: data.metadata.viewPosition,
              scale: data.metadata.scale,
              animation: { duration: 0 },
            });
          } else network.fit({ animation: { duration: 0 } });
          setTimeout(
            () =>
              nodes
                .get()
                .forEach((n) => nodes.update({ id: n.id, fixed: false })),
            300,
          );
        }, 100);
      }, 100);
    } catch (err) {
      console.log("Load error:", err);
    }
    fileInput.value = "";
  });

  btnClose.addEventListener("click", () => {
    document.getElementById("side-panel").classList.remove("open");
    document.getElementById("panel-iframe").srcdoc = "";
    document.getElementById("panel-title").textContent = "";
    setActiveNodeId(null);
  });

  if (langSelect) {
    langSelect.value = getCurrentLang();
    langSelect.addEventListener("change", () => {
      setCurrentLang(langSelect.value);
      updatePlaceholder();
      searchInput.value = "";
      searchResults.innerHTML = "";
      searchResults.style.display = "none";
      selectedResultIndex = -1;
    });
  }

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) {
      searchResults.innerHTML = "";
      searchResults.style.display = "none";
      selectedResultIndex = -1;
      return;
    }
    searchTimeout = setTimeout(async () => {
      searchResults.innerHTML =
        '<div class="search-loading">Searching...</div>';
      searchResults.style.display = "block";
      try {
        const results = await searchWikipedia(q);
        if (results.length === 0)
          searchResults.innerHTML =
            '<div class="search-result-item no-results">No results found</div>';
        else {
          currentSearchResults = results;
          displaySearchResults(results);
        }
      } catch {
        searchResults.innerHTML =
          '<div class="search-result-item error">Search failed.</div>';
      }
    }, 300);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchResults.style.display = "none";
      selectedResultIndex = -1;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentSearchResults.length) {
        selectedResultIndex =
          (selectedResultIndex + 1) % currentSearchResults.length;
        displaySearchResults(currentSearchResults);
        scrollToSelectedResult();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentSearchResults.length) {
        selectedResultIndex =
          selectedResultIndex <= 0
            ? currentSearchResults.length - 1
            : selectedResultIndex - 1;
        displaySearchResults(currentSearchResults);
        scrollToSelectedResult();
      }
    } else if (e.key === "Enter" && selectedResultIndex >= 0) {
      e.preventDefault();
      handleSearchResultSelect(
        currentSearchResults[selectedResultIndex].url,
        currentSearchResults[selectedResultIndex].title,
      );
    }
  });

  searchResults.addEventListener("click", (e) => {
    const item = e.target.closest(".search-result-item");
    if (item?.dataset.url)
      handleSearchResultSelect(
        item.dataset.url,
        item.querySelector(".search-result-title").textContent,
      );
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".search-container").contains(e.target)) {
      searchResults.style.display = "none";
      selectedResultIndex = -1;
    }
  });

  fileUploadInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    const rect = document.getElementById("mynetwork").getBoundingClientRect();
    const center = network.DOMtoCanvas({
      x: rect.width / 2,
      y: rect.height / 2,
    });
    files.forEach((f, i) =>
      setTimeout(
        () =>
          handleFileUpload(
            f,
            rect.left + rect.width / 2 + i * 30,
            rect.top + rect.height / 2 + i * 30,
          ),
        i * 100,
      ),
    );
    fileUploadInput.value = "";
  });

  const sidePanel = document.getElementById("side-panel");
  const resizeHandle = sidePanel.querySelector(".resize-handle");
  if (!resizeHandle) return;

  let startX, startWidth, startPointerId;

  const savedWidth = localStorage.getItem("sidePanelWidth");
  if (savedWidth) {
    sidePanel.style.width = savedWidth;
  }

  const onPointerMove = (e) => {
    const dx = e.clientX - startX;
    let newWidth = startWidth - dx;
    newWidth = Math.min(Math.max(newWidth, 300), window.innerWidth * 0.95);
    sidePanel.style.width = newWidth + "px";
  };

  const onPointerUp = () => {
    resizeHandle.releasePointerCapture(startPointerId);
    resizeHandle.removeEventListener("pointermove", onPointerMove);
    resizeHandle.removeEventListener("pointerup", onPointerUp);
    sidePanel.style.transition = ""; 
    localStorage.setItem("sidePanelWidth", sidePanel.style.width);
  };

  resizeHandle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = parseInt(getComputedStyle(sidePanel).width, 10);
    startPointerId = e.pointerId;
    sidePanel.style.transition = "none";

    resizeHandle.setPointerCapture(e.pointerId);
    resizeHandle.addEventListener("pointermove", onPointerMove);
    resizeHandle.addEventListener("pointerup", onPointerUp);
  });
}
