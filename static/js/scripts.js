async function parseWikiArticle(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const title = doc.querySelector('#firstHeading')?.textContent.trim() || 'Untitled';
  const contentEl = doc.querySelector('.mw-parser-output');
  if (!contentEl) {
    return { title, content: '<p>Main content not found</p>', links: [] };
  }


  const refs = Array.from(contentEl.querySelectorAll('h2'))
    .find(h2 => /References|Notes|Footnotes/.test(h2.textContent));
  if (refs) {
    let el = refs.nextElementSibling;
    while (el) {
      const next = el.nextElementSibling;
      el.remove();
      el = next;
    }
    refs.remove();
  }


  const links = new Set();
  contentEl.querySelectorAll('a[href^="/wiki/"]').forEach(a => {
    const h = a.getAttribute('href');
    if (!h.includes(':')) {
      const full = new URL(h, url).toString();
      links.add(full);
      a.href = full;
      a.target = '_blank';
    }
  });


  contentEl.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('//')) img.src = 'https:' + src;
    if (img.srcset) {
      img.srcset = img.srcset.replace('//', 'https://');
    }
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  });

  return { title, content: contentEl.innerHTML, links: Array.from(links) };
}


async function getRandomWikiURL() {
  const resp = await fetch('https://en.wikipedia.org/wiki/Special:Random', { redirect: 'follow' });
  return resp.url;
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('wiki-url');
  const limitInput = document.getElementById('link-limit');
  const btnGo = document.getElementById('btn-ok');
  const btnRand = document.getElementById('btn-random');
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const fileInput = document.getElementById('file-input');
  const netContainer = document.getElementById('mynetwork');
  const sidePanel = document.getElementById('side-panel');
  const btnClose = document.getElementById('btn-close');
  const panelTitle = document.getElementById('panel-title');
  const panelContent = document.getElementById('panel-content');


  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'context-menu';
  Object.assign(ctxMenu.style, {
    position: 'absolute', display: 'none', border: '1px solid #333',
    background: '#1a1a1a', color: '#e0e0e0', padding: '4px', zIndex: 9999
  });
  document.body.appendChild(ctxMenu);

  let nodes, edges, network;
  let urlMap = {}, nextId = 0, firstSel = null;

  function initNetwork() {
    nodes = new vis.DataSet();
    edges = new vis.DataSet();
    network = new vis.Network(netContainer, { nodes, edges }, {
      nodes: {
        shape: 'box', shapeProperties: { borderRadius: 0 },
        color: { background: '#FFFFFF', highlight: { background: '#FFFFFF', border: '#00BFFF' }, hover: { background: '#FFFFFF', border: '#99EFFF' } },
        borderWidth: 2, font: { size: 14, color: '#000000' }, widthConstraint: 70, heightConstraint: 40
      },
      edges: { color: { color: '#00BFFF', highlight: '#66DFFF', hover: '#99EFFF' }, width: 2, smooth: { type: 'continuous' } },
      physics: { enabled: true, solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -150, springLength: 100, avoidOverlap: 1 }, stabilization: { iterations: 300 } },
      interaction: { dragNodes: true, zoomView: true }
    });


    network.on('click', async params => {
      const ev = params.event?.srcEvent || params.event;
      if (params.nodes.length && !ev.shiftKey && ev.which === 1) await expandNode(params.nodes[0]);
    });


    network.on('click', params => {
      const ev = params.event?.srcEvent || params.event;
      if (params.nodes.length && ev.shiftKey && ev.which === 1) {
        const id = params.nodes[0];
        if (firstSel === null) { firstSel = id; network.selectNodes([id]); }
        else if (firstSel !== id) {
          if (!edges.get({ filter: e => e.from === firstSel && e.to === id }).length)
            edges.add({ from: firstSel, to: id });
          network.unselectAll(); firstSel = null;
        }
      }
    });


    netContainer.addEventListener('dragover', e => e.preventDefault());
    netContainer.addEventListener('drop', e => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const { url, title } = JSON.parse(data);
      const pos = network.DOMtoCanvas({ x: e.offsetX, y: e.offsetY });
      const id = nextId++;
      urlMap[url] = id;
      nodes.add({ id, label: title, url, x: pos.x, y: pos.y });
    });


    netContainer.addEventListener('contextmenu', e => {
      e.preventDefault();
      const pos = { x: e.offsetX, y: e.offsetY };
      const id = network.getNodeAt(pos);
      if (ctxMenu.style.display === 'block') { ctxMenu.style.display = 'none'; return; }
      if (id !== undefined) showNodeMenu(e.pageX, e.pageY, id);
    });
  }

  function showNodeMenu(x, y, id) {
    ctxMenu.innerHTML = '';
    ['Open', 'Delete', 'Detach'].forEach(txt => {
      const div = document.createElement('div'); div.textContent = txt;
      div.style.padding = '5px'; div.style.cursor = 'pointer'; div.style.color = '#e0e0e0';
      div.addEventListener('mouseenter', () => div.style.background = '#333');
      div.addEventListener('mouseleave', () => div.style.background = '');
      if (txt === 'Open') div.onclick = async () => { hideMenu(); await expandNode(id); };
      if (txt === 'Delete') div.onclick = () => { hideMenu(); removeNode(id); };
      if (txt === 'Detach') div.onclick = () => { hideMenu(); toggleDetach(id); };
      ctxMenu.appendChild(div);
    });
    ctxMenu.style.left = x + 'px'; ctxMenu.style.top = y + 'px'; ctxMenu.style.display = 'block';
  }

  function hideMenu() { ctxMenu.style.display = 'none'; }

  function makeLinksDraggable(container) {
    container.querySelectorAll('a').forEach(a => {
      a.draggable = true;
      a.addEventListener('dragstart', ev => {
        ev.dataTransfer.setData('application/json', JSON.stringify({ url: a.href, title: a.textContent.trim() }));
        ev.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  async function expandNode(id) {
    const { title, content, links } = await parseWikiArticle(nodes.get(id).url);
    panelTitle.textContent = title;
    panelContent.innerHTML = content;
    sidePanel.classList.add('open');
    nodes.update({ id, label: title, url: nodes.get(id).url });

    makeLinksDraggable(panelContent);
    links.slice(0, +limitInput.value).forEach(link => {
      let lid = urlMap[link];
      if (lid === undefined) {
        lid = nextId++; urlMap[link] = lid;
        const lbl = decodeURIComponent(link.split('/').pop()).replace(/_/g, ' ');
        nodes.add({ id: lid, label: lbl, url: link });
      }
      if (!edges.get({ filter: e => e.from === id && e.to === lid }).length)
        edges.add({ from: id, to: lid });
    });
  }

  function removeNode(id) {
    edges.remove(network.getConnectedEdges(id));
    nodes.remove(id);
    for (const u in urlMap) if (urlMap[u] === id) delete urlMap[u];
  }

  function toggleDetach(id) {
    const n = nodes.get(id);
    if (!n.detached) {
      const con = network.getConnectedEdges(id).map(e => edges.get(e)).flat();
      n.detachedEdges = con; n.detached = true;
      edges.remove(network.getConnectedEdges(id));
    } else {
      edges.add(n.detachedEdges || []);
      n.detached = false; n.detachedEdges = null;
    }
    nodes.update(n);
  }

  btnGo.addEventListener('click', async () => {
    const u = urlInput.value.trim(); if (!u) return;
    nodes.clear(); edges.clear(); urlMap = {}; nextId = 0; firstSel = null;
    const root = nextId++; urlMap[u] = root;
    nodes.add({ id: root, label: u, url: u });
    await expandNode(root);
  });

  btnRand.addEventListener('click', async () => {
    nodes.clear(); edges.clear(); urlMap = {}; nextId = 0; firstSel = null;
    const r = await getRandomWikiURL(); urlInput.value = r;
    const root = nextId++; urlMap[r] = root;
    nodes.add({ id: root, label: r, url: r });
    await expandNode(root);
  });

  btnSave.addEventListener('click', () => {
    const graph = { nodes: nodes.get(), edges: edges.get() };
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'graph.json'; document.body.appendChild(a); a.click(); a.remove();
  });

  btnLoad.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const { nodes: nds, edges: eds } = JSON.parse(ev.target.result);
      nodes.clear(); edges.clear(); urlMap = {}; nextId = 0; firstSel = null;
      nodes.add(nds); edges.add(eds);
      nds.forEach(n => { if (n.url) urlMap[n.url] = n.id; nextId = Math.max(nextId, n.id + 1); });
    };
    r.readAsText(f);
  });

  btnClose.addEventListener('click', () => sidePanel.classList.remove('open'));

  initNetwork();
});
