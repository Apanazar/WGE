document.addEventListener('DOMContentLoaded', function() {
    const inputUrl   = document.getElementById('wiki-url');
    const inputLimit = document.getElementById('link-limit');
    const btnOk      = document.getElementById('btn-ok');
    const btnRandom  = document.getElementById('btn-random');
    const networkContainer = document.getElementById('mynetwork');
  
    const sidePanel  = document.getElementById('side-panel');
    const btnClose   = document.getElementById('btn-close');
    const panelTitle = document.getElementById('panel-title');
    const panelContent = document.getElementById('panel-content');
  
    let nodesData, edgesData, network;
    let urlToNodeId = {};
    let currentNodeId = 0;
  
    function initNetwork() {
      nodesData = new vis.DataSet();
      edgesData = new vis.DataSet();
  
      const data = {
        nodes: nodesData,
        edges: edgesData
      };
  
      const options = {
        nodes: {
          shape: 'box',
          shapeProperties: {
            borderRadius: 0
          },
          color: {
            background: '#FFFFFF',
            highlight: {
              background: '#FFFFFF',
              border: '#FFFF00'
            },
            hover: {
              background: '#FFFFFF',
              border: '#FFFF00'
            }
          },
          borderWidth: 2,
          font: {
            size: 14,
            color: '#000000',
          },
          widthConstraint: 70,
          heightConstraint: 40,
        },
        edges: {
          color: {
            color: '#FFFF00',
            highlight: '#FFFF00',
            hover: '#FFFF00'
          },
          width: 2,
          smooth: { type: 'continuous' }
        },
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -230,
            springLength: 100,
            avoidOverlap: 1
          },
          stabilization: { iterations: 300 }
        },
        interaction: { 
          dragNodes: true,
          zoomView: true 
        }
      };
      
      network = new vis.Network(networkContainer, data, options);
      network.on('click', async (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = nodesData.get(nodeId);
          if (node && node.url) {
            const limit = parseInt(inputLimit.value) || 5;
            await parseArticleAndExpand(node.url, limit);
          }
        }
      });
    }
  
    async function parseArticleAndExpand(url, limit) {
      try {
        const resp = await fetch(`/parse?url=${encodeURIComponent(url)}&limit=${limit}`);
        if (!resp.ok) {
          alert('Article parsing error');
          return;
        }
        const data = await resp.json();
  
        panelTitle.textContent = data.title || 'Untitled';
        panelContent.innerHTML = data.content || '';
        sidePanel.classList.add('open');
  
        let nodeId = urlToNodeId[url];
        if (nodeId === undefined) {
          nodeId = currentNodeId++;
          urlToNodeId[url] = nodeId;
          nodesData.add({
            id: nodeId,
            label: data.title,
            url: url
          });
        } else {
          nodesData.update({
            id: nodeId,
            label: data.title,
            url: url
          });
        }
  
        for (const linkObj of data.links) {
          const linkUrl = linkObj.url;
          let linkId = urlToNodeId[linkUrl];
  
          if (linkId === undefined) {
            linkId = currentNodeId++;
            urlToNodeId[linkUrl] = linkId;
            nodesData.add({
              id: linkId,
              label: linkObj.title,
              url: linkUrl
            });
          }
  
          if (!edgeExists(nodeId, linkId)) {
            edgesData.add({ from: nodeId, to: linkId });
          }
        }
      } catch (err) {
        console.error(err);
        alert('Request error: /parse');
      }
    }
  
    function edgeExists(fromId, toId) {
      const edges = edgesData.get({
        filter: (edge) => (edge.from === fromId && edge.to === toId)
      });
      return edges.length > 0;
    }
  
    btnClose.addEventListener('click', () => {
      sidePanel.classList.remove('open');
    });
  
    btnOk.addEventListener('click', async () => {
      const articleUrl = inputUrl.value.trim();
      if (!articleUrl) return;
  
      nodesData.clear();
      edgesData.clear();
      urlToNodeId = {};
      currentNodeId = 0;
  
      const limit = parseInt(inputLimit.value) || 5;
      await parseArticleAndExpand(articleUrl, limit);
    });
  
    btnRandom.addEventListener('click', async () => {
      try {
        const resp = await fetch('/random');
        if (!resp.ok) {
          alert('Error (random page)');
          return;
        }
        const data = await resp.json();
        if (data.url) {
          nodesData.clear();
          edgesData.clear();
          urlToNodeId = {};
          currentNodeId = 0;
  
          const limit = parseInt(inputLimit.value) || 5;
          await parseArticleAndExpand(data.url, limit);
        }
      } catch (err) {
        console.error(err);
        alert('Request error: /random');
      }
    });
  
    initNetwork();
  });
  