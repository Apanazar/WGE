import { getFirstSel, setFirstSel } from './state.js';
import { expandNode, addSingleNode, addNoticeNode } from './nodes.js';
import { showNodeMenu, showCanvasMenu, hideMenu, isMenuVisible, handleFileUpload } from './ui.js';
import { showModal, isValidUrl, isValidFilePath } from './utils.js';

export let nodes, edges, network;

export function initNetwork() {
    nodes = new vis.DataSet();
    edges = new vis.DataSet();

    const options = {
        nodes: {
            shape: 'box',
            shapeProperties: { borderRadius: 6 },
            color: {
                background: '#2c3e50',
                border: '#34495e',
                highlight: { background: '#3498db', border: '#2980b9' },
                hover: { background: '#34495e', border: '#2c3e50' }
            },
            borderWidth: 2,
            font: { size: 14, color: '#ecf0f1', face: 'Arial, sans-serif' },
            margin: 12,
            widthConstraint: { minimum: 100, maximum: 250 },
            heightConstraint: 40,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 10, x: 5, y: 5 }
        },
        edges: {
            color: { color: '#7f8c8d', highlight: '#3498db', hover: '#3498db' },
            width: 2,
            smooth: { type: 'continuous' },
            shadow: true,
            arrows: { to: { enabled: false }, middle: { enabled: false }, from: { enabled: false } }
        },
        physics: { enabled: false },
        interaction: {
            dragNodes: true, zoomView: true, dragView: true,
            hover: true, tooltipDelay: 200, multiselect: true
        },
        layout: { randomSeed: undefined, improvedLayout: false, hierarchical: false }
    };

    const netContainer = document.getElementById('mynetwork');
    network = new vis.Network(netContainer, { nodes, edges }, options);

    network.on('click', async params => {
        const ev = params.event?.srcEvent || params.event;
        if (params.nodes.length && !ev.shiftKey && ev.which === 1) {
            await expandNode(params.nodes[0]);
        }
    });

    network.on('click', params => {
        const ev = params.event?.srcEvent || params.event;
        if (params.nodes.length && ev.shiftKey && ev.which === 1) {
            const id = params.nodes[0];
            const first = getFirstSel();
            if (first === null) {
                setFirstSel(id);
                network.selectNodes([id]);
            } else if (first !== id) {
                const existingEdge = edges.get({
                    filter: e => (e.from === first && e.to === id) || (e.from === id && e.to === first)
                }).length;
                if (!existingEdge) edges.add({ from: first, to: id });
                network.unselectAll();
                setFirstSel(null);
            }
        }
    });

    netContainer.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    netContainer.addEventListener('drop', async e => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let file of e.dataTransfer.files) {
                await handleFileUpload(file, e.clientX, e.clientY);
            }
        } else {
            const data = e.dataTransfer.getData('application/json');
            if (data) {
                try {
                    const { url, title, type } = JSON.parse(data);
                    const rect = netContainer.getBoundingClientRect();
                    const pos = network.DOMtoCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    if (type === 'notice') {
                        addNoticeNode(pos.x, pos.y, title);
                    } else if (url) {
                        const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';
                        if (nodeType === 'web') {
                            const enteredTitle = await showModal(
                                'Enter title for the web page',
                                decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
                            );
                            if (enteredTitle !== null) addSingleNode(url, pos.x, pos.y, enteredTitle, nodeType);
                        } else {
                            addSingleNode(url, pos.x, pos.y, null, nodeType);
                        }
                    }
                } catch (error) { console.log('Drop error:', error); }
            } else {
                const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (url && (isValidUrl(url) || isValidFilePath(url))) {
                    const rect = netContainer.getBoundingClientRect();
                    const pos = network.DOMtoCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';
                    if (nodeType === 'web') {
                        const enteredTitle = await showModal(
                            'Enter title for the web page',
                            decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
                        );
                        if (enteredTitle !== null) addSingleNode(url, pos.x, pos.y, enteredTitle, nodeType);
                    } else {
                        addSingleNode(url, pos.x, pos.y, null, nodeType);
                    }
                }
            }
        }
    });

    netContainer.addEventListener('contextmenu', e => {
        e.preventDefault();
        const rect = netContainer.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const id = network.getNodeAt(pos);
        if (isMenuVisible()) {
            hideMenu();
            return;
        }
        if (id !== undefined) {
            showNodeMenu(e.pageX, e.pageY, id);
        } else {
            showCanvasMenu(e.pageX, e.pageY);
        }
    });

    document.addEventListener('click', hideMenu);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') hideMenu();
    });
}