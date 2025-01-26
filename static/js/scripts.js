document.addEventListener("DOMContentLoaded", function () {
  const inputUrl = document.getElementById("wiki-url");
  const inputLimit = document.getElementById("link-limit");
  const btnOk = document.getElementById("btn-ok");
  const btnRandom = document.getElementById("btn-random");
  const btnSave = document.getElementById("btn-save");
  const btnLoad = document.getElementById("btn-load");
  const fileInput = document.getElementById("file-input");
  const networkContainer = document.getElementById("mynetwork");
  const sidePanel = document.getElementById("side-panel");
  const btnClose = document.getElementById("btn-close");
  const panelTitle = document.getElementById("panel-title");
  const panelContent = document.getElementById("panel-content");

  const contextMenu = document.createElement("div");
  contextMenu.id = "context-menu";
  contextMenu.style.position = "absolute";
  contextMenu.style.display = "none";
  contextMenu.style.background = "#0000AA";
  contextMenu.style.border = "1px solid #FFFFFF";
  contextMenu.style.padding = "4px";
  contextMenu.style.zIndex = 9999;
  document.body.appendChild(contextMenu);

  let nodesData, edgesData, network;
  let urlToNodeId = {};
  let currentNodeId = 0;
  let firstSelectedNodeId = null;

  function initNetwork() {
    nodesData = new vis.DataSet();
    edgesData = new vis.DataSet();

    const data = {
      nodes: nodesData,
      edges: edgesData,
    };

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: { borderRadius: 0 },
        color: {
          background: "#FFFFFF",
          highlight: { background: "#FFFFFF", border: "#FFFF00" },
          hover: { background: "#FFFFFF", border: "#FFFF00" },
        },
        borderWidth: 2,
        font: { size: 14, color: "#000000" },
        widthConstraint: 70,
        heightConstraint: 40,
      },
      edges: {
        color: {
          color: "#FFFF00",
          highlight: "#FFFF00",
          hover: "#FFFF00",
        },
        width: 2,
        smooth: { type: "continuous" },
      },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -150,
          springLength: 100,
          avoidOverlap: 1,
        },
        stabilization: { iterations: 300 },
      },
      interaction: {
        dragNodes: true,
        zoomView: true,
      },
    };

    network = new vis.Network(networkContainer, data, options);
    network.on("click", async (params) => {
      const ev = params.event?.srcEvent || params.event;
      if (params.nodes.length > 0 && ev && !ev.shiftKey && ev.which === 1) {
        const nodeId = params.nodes[0];
        const node = nodesData.get(nodeId);
        if (node && node.url) {
          const limit = parseInt(inputLimit.value) || 5;
          await parseArticleAndExpand(node.url, limit);
        }
      }
    });

    network.on("click", (params) => {
      const ev = params.event?.srcEvent || params.event;
      if (params.nodes.length > 0 && ev && ev.shiftKey && ev.which === 1) {
        const nodeId = params.nodes[0];
        if (firstSelectedNodeId === null) {
          firstSelectedNodeId = nodeId;
          network.selectNodes([nodeId]);
        } else {
          if (firstSelectedNodeId !== nodeId) {
            if (
              !edgeExists(firstSelectedNodeId, nodeId) &&
              !edgeExists(nodeId, firstSelectedNodeId)
            ) {
              edgesData.add({ from: firstSelectedNodeId, to: nodeId });
            }
          }
          network.unselectAll();
          firstSelectedNodeId = null;
        }
      }
    });

    networkContainer.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();

      const pointer = { x: ev.offsetX, y: ev.offsetY };
      const nodeId = network.getNodeAt(pointer);
      const pageX = ev.pageX;
      const pageY = ev.pageY;

      if (nodeId !== undefined) {
        showNodeContextMenu(pageX, pageY, nodeId);
      } else {
        showEmptyContextMenu(pageX, pageY, pointer);
      }
    });

    networkContainer.addEventListener("dragover", (ev) => {
      ev.preventDefault();
    });
    networkContainer.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const dataStr = ev.dataTransfer.getData("text/plain");
      if (!dataStr) return;

      let obj;
      try {
        obj = JSON.parse(dataStr);
      } catch (e) {
        return;
      }

      const { url, title, fromNodeId } = obj;
      const pos = network.DOMtoCanvas({ x: ev.offsetX, y: ev.offsetY });

      const newNodeId = currentNodeId++;
      urlToNodeId[url] = newNodeId;
      nodesData.add({
        id: newNodeId,
        label: title,
        url: url,
        x: pos.x,
        y: pos.y,
      });
      if (fromNodeId != null) {
        edgesData.add({ from: fromNodeId, to: newNodeId });
      }
    });
  }

  function showNodeContextMenu(pageX, pageY, nodeId) {
    contextMenu.innerHTML = "";

    const openItem = document.createElement("div");
    openItem.textContent = "Открыть (parse)";
    styleContextItem(openItem);
    openItem.addEventListener("click", async () => {
      hideContextMenu();
      const node = nodesData.get(nodeId);
      if (node && node.url) {
        const limit = parseInt(inputLimit.value) || 5;
        await parseArticleAndExpand(node.url, limit);
      }
    });
    contextMenu.appendChild(openItem);

    const removeItem = document.createElement("div");
    removeItem.textContent = "Удалить";
    styleContextItem(removeItem);
    removeItem.addEventListener("click", () => {
      hideContextMenu();
      removeNode(nodeId);
    });
    contextMenu.appendChild(removeItem);

    const detachItem = document.createElement("div");
    detachItem.textContent = "Открепить/Прикрепить";
    styleContextItem(detachItem);
    detachItem.addEventListener("click", () => {
      hideContextMenu();
      toggleNodeDetached(nodeId);
    });
    contextMenu.appendChild(detachItem);

    contextMenu.style.left = pageX + "px";
    contextMenu.style.top = pageY + "px";
    contextMenu.style.display = "block";
  }

  function showEmptyContextMenu(pageX, pageY, pointer) {
    contextMenu.innerHTML = "";

    const label = document.createElement("div");
    label.textContent = "Добавить (wiki):";
    styleContextItem(label, true);
    contextMenu.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "https://ru.wikipedia.org/wiki/...";
    input.style.width = "300px";
    input.style.margin = "4px 0";
    contextMenu.appendChild(input);

    const addBtn = document.createElement("button");
    addBtn.textContent = "Добавить";
    addBtn.style.margin = "4px 0";
    addBtn.addEventListener("click", async () => {
      hideContextMenu();
      const url = input.value.trim();
      if (url) {
        const limit = parseInt(inputLimit.value) || 5;
        const pos = network.DOMtoCanvas({ x: pointer.x, y: pointer.y });
        await parseArticleAndExpand(url, limit, pos);
      }
    });
    contextMenu.appendChild(addBtn);

    contextMenu.style.left = pageX + "px";
    contextMenu.style.top = pageY + "px";
    contextMenu.style.display = "block";
  }

  function styleContextItem(el, bold = false) {
    el.style.padding = "5px";
    el.style.cursor = "pointer";
    if (bold) {
      el.style.fontWeight = "bold";
    }
    el.addEventListener("mouseenter", () => {
      el.style.backgroundColor = "#000066";
    });
    el.addEventListener("mouseleave", () => {
      el.style.backgroundColor = "";
    });
  }

  function hideContextMenu() {
    contextMenu.style.display = "none";
  }

  function removeNode(nodeId) {
    const connectedEdges = network.getConnectedEdges(nodeId);
    edgesData.remove(connectedEdges);
    nodesData.remove(nodeId);

    const entry = Object.entries(urlToNodeId).find(
      ([_, val]) => val === nodeId
    );
    if (entry) {
      delete urlToNodeId[entry[0]];
    }
  }

  function toggleNodeDetached(nodeId) {
    let node = nodesData.get(nodeId);
    if (!node) return;

    let connectedEdges = network.getConnectedEdges(nodeId);
    if (!node.detached) {
      let theseEdges = edgesData.get(connectedEdges);
      node.detachedEdges = theseEdges;
      node.detached = true;
      edgesData.remove(connectedEdges);
      nodesData.update(node);
    } else {
      let theseEdges = node.detachedEdges || [];
      edgesData.add(theseEdges);
      node.detachedEdges = null;
      node.detached = false;
      nodesData.update(node);
    }
  }

  async function parseArticleAndExpand(url, limit, pos) {
    try {
      const resp = await fetch(
        `/parse?url=${encodeURIComponent(url)}&limit=${limit}`
      );
      if (!resp.ok) {
        alert("Article parsing error");
        return;
      }
      const data = await resp.json();

      panelTitle.textContent = data.title || "Untitled";
      panelContent.innerHTML = data.content || "";
      sidePanel.classList.add("open");

      makeAllLinksDraggable(panelContent, urlToNodeId[url]);

      let nodeId = urlToNodeId[url];
      let isNewNode = false;

      if (nodeId === undefined) {
        nodeId = currentNodeId++;
        urlToNodeId[url] = nodeId;
        isNewNode = true;
        nodesData.add({
          id: nodeId,
          label: data.title,
          url: url,
        });
      } else {
        nodesData.update({
          id: nodeId,
          label: data.title,
          url: url,
        });
      }

      if (pos && isNewNode) {
        nodesData.update({
          id: nodeId,
          x: pos.x,
          y: pos.y,
        });
      }

      for (const linkObj of data.links) {
        const linkUrl = linkObj.url;
        let linkNodeId = urlToNodeId[linkUrl];
        if (linkNodeId === undefined) {
          linkNodeId = currentNodeId++;
          urlToNodeId[linkUrl] = linkNodeId;
          nodesData.add({
            id: linkNodeId,
            label: linkObj.title,
            url: linkUrl,
          });
        }
        if (
          !edgeExists(nodeId, linkNodeId) &&
          !edgeExists(linkNodeId, nodeId)
        ) {
          edgesData.add({ from: nodeId, to: linkNodeId });
        }
      }
    } catch (err) {
      console.error(err);
      alert("Request error: /parse");
    }
  }

  function makeAllLinksDraggable(container, fromNodeId) {
    const allAnchors = container.querySelectorAll("a");
    allAnchors.forEach((a) => {
      a.addEventListener("click", (ev) => ev.preventDefault());
      a.draggable = true;
      a.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            url: a.href,
            title: a.textContent,
            fromNodeId: fromNodeId,
          })
        );
        ev.dataTransfer.effectAllowed = "move";
      });
    });
  }

  function edgeExists(fromId, toId) {
    const edges = edgesData.get({
      filter: (edge) => edge.from === fromId && edge.to === toId,
    });
    return edges.length > 0;
  }

  btnClose.addEventListener("click", () => {
    sidePanel.classList.remove("open");
  });

  btnOk.addEventListener("click", async () => {
    const articleUrl = inputUrl.value.trim();
    if (!articleUrl) return;

    nodesData.clear();
    edgesData.clear();
    urlToNodeId = {};
    currentNodeId = 0;
    firstSelectedNodeId = null;

    const limit = parseInt(inputLimit.value) || 5;
    await parseArticleAndExpand(articleUrl, limit);
  });

  btnRandom.addEventListener("click", async () => {
    try {
      const resp = await fetch("/random");
      if (!resp.ok) {
        alert("Error (random page)");
        return;
      }
      const data = await resp.json();
      if (data.url) {
        nodesData.clear();
        edgesData.clear();
        urlToNodeId = {};
        currentNodeId = 0;
        firstSelectedNodeId = null;

        const limit = parseInt(inputLimit.value) || 5;
        await parseArticleAndExpand(data.url, limit);
      }
    } catch (err) {
      console.error(err);
      alert("Request error: /random");
    }
  });

  btnSave.addEventListener("click", () => {
    console.log("clicked");
    handleSaveGraph();
  });

  btnLoad.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const graph = JSON.parse(content);

        nodesData.clear();
        edgesData.clear();
        urlToNodeId = {};
        currentNodeId = 0;
        firstSelectedNodeId = null;

        nodesData.add(graph.nodes);
        edgesData.add(graph.edges);

        for (const n of graph.nodes) {
          if (n.url) {
            urlToNodeId[n.url] = n.id;
          }
          if (n.id >= currentNodeId) {
            currentNodeId = n.id + 1;
          }
        }
      } catch (err) {
        alert("Ошибка при чтении JSON-файла: " + err);
      }
    };
    reader.readAsText(file);
  });

  initNetwork();

  function handleSaveGraph() {
    const nodes = nodesData.get();
    const edges = edgesData.get();
    const graph = { nodes, edges };

    const jsonStr = JSON.stringify(graph, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "my-graph.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
});
