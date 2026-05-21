import { nodes, edges, network } from './network.js';
import { getUrlMap, incrementNextId, getActiveNodeId, setActiveNodeId } from './state.js';
import { parseWikiArticle, parseWebPage } from './api.js';
import { showModal } from './utils.js';

export function addSingleNode(url, x, y, customTitle = null, type = 'wikipedia') {
    const map = getUrlMap();
    if (map[url]) return;
    const id = incrementNextId();
    map[url] = id;
    let title = customTitle;
    if (!title) {
        try {
            title = decodeURIComponent(url.split('/').pop()).replace(/_/g, ' ').replace(/%20/g, ' ');
        } catch (e) {
            title = type === 'wikipedia' ? 'Wikipedia Article' : 'Web Page';
        }
    }
    const shortLabel = title.length > 30 ? title.substring(0, 30) + '...' : title;
    const color = type === 'wikipedia'
        ? { background: '#9b59b6', border: '#8e44ad', highlight: { background: '#9b59b6', border: '#8e44ad' } }
        : { background: '#1abc9c', border: '#16a085', highlight: { background: '#1abc9c', border: '#16a085' } };
    nodes.add({
        id, label: shortLabel, url, type,
        x: x || 0, y: y || 0, color,
        fixed: { x: true, y: true }
    });
    setTimeout(() => nodes.update({ id, fixed: false }), 100);
}

export function addNoticeNode(x, y, title = 'New notice') {
    const id = incrementNextId();
    const shortLabel = title.length > 30 ? title.substring(0, 30) + '...' : title;
    nodes.add({
        id, label: shortLabel, type: 'notice',
        noticeData: { title, content: '', created: new Date().toISOString(), updated: new Date().toISOString() },
        x, y,
        color: { background: '#f1c40f', border: '#f39c12', highlight: { background: '#f1c40f', border: '#f39c12' }, font: { color: '#000000' } },
        font: { color: '#000000' }
    });
    setTimeout(() => expandNode(id), 100);
}

export async function expandNode(id) {

    if (getActiveNodeId() === id) return;

    const node = nodes.get(id);
    if (!node) return;

    setActiveNodeId(id);
    document.getElementById('panel-title').textContent = 'Loading...';
    document.getElementById('side-panel').classList.add('open');

    switch (node.type) {
        case 'wikipedia': await expandWikipediaNode(node); break;
        case 'web': await expandWebNode(node); break;
        case 'notice': expandNoticeNode(node); break;
        case 'image': expandImageNode(node); break;
        case 'video': expandVideoNode(node); break;
        case 'file': expandFileNode(node); break;
        
        default: document.getElementById('panel-iframe').srcdoc = '<html><body><p>Unknown node type</p></body></html>';
    }
}

async function expandWikipediaNode(node) {
    const { title, content } = await parseWikiArticle(node.url);
    document.getElementById('panel-title').textContent = title;
    const shortTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
    nodes.update({ id: node.id, label: shortTitle });
    document.getElementById('panel-iframe').srcdoc = content;
}

async function expandWebNode(node) {
    try {
        const { title } = await parseWebPage(node.url);
        document.getElementById('panel-title').textContent = title || node.label;
    } catch { }
    document.getElementById('panel-iframe').srcdoc = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden} iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style>
        </head><body><iframe src="${node.url}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe></body></html>`;
}

function expandNoticeNode(node) {
    document.getElementById('panel-title').textContent = 'Notice Editor';
    const noticeData = node.noticeData || { title: 'New notice', content: '', created: new Date().toISOString(), updated: new Date().toISOString() };
    document.getElementById('panel-iframe').srcdoc = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{padding:15px;background:#1a1a1a;color:#e0e0e0;font-family:'Segoe UI',sans-serif;height:100vh;overflow:hidden;font-size:13px}
.title-input{width:100%;padding:10px;margin-bottom:15px;background:#2a2a2a;color:#fff;border:1px solid #444;border-radius:6px;font-size:13px}
.editor-container{height:calc(100vh - 60px)}.EasyMDEContainer,.CodeMirror,.editor-preview,.editor-toolbar{background:#2a2a2a!important;color:#e0e0e0!important;border-color:#444!important}
.editor-toolbar button{color:#e0e0e0!important;font-size:12px!important}.editor-toolbar button:hover{background:#333!important}
.CodeMirror{font-size:14px;height:auto!important;max-height:400px!important}.CodeMirror-scroll{overflow-y:auto!important;overflow-x:auto!important;max-height:400px!important}
.CodeMirror-scroll::-webkit-scrollbar{width:10px;height:10px}.CodeMirror-scroll::-webkit-scrollbar-track{background:#1a1a1a}
.CodeMirror-scroll::-webkit-scrollbar-thumb{background:#444;border-radius:5px}.CodeMirror-scroll::-webkit-scrollbar-thumb:hover{background:#555}</style>
</head><body>
<input type="text" id="notice-title" class="title-input" value="${noticeData.title.replace(/"/g, '&quot;')}" placeholder="Title">
<div class="editor-container"><textarea id="editor-area">${noticeData.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea></div>
<script>
const easyMDE = new EasyMDE({element:document.getElementById('editor-area'),autoDownloadFontAwesome:false,spellChecker:false,status:false,sideBySideFullscreen:false,
toolbar:['bold','italic','heading','|','code','quote','unordered-list','ordered-list','|','link','image','|','preview','side-by-side','fullscreen','|','guide'],
forceSync:true,autoFocus:true});
function saveChanges(){const title=document.getElementById('notice-title').value;const content=easyMDE.value();
window.parent.postMessage({type:'notice-update',data:{id:${node.id},title,content}},'*');}
let saveTimeout;function scheduleSave(){clearTimeout(saveTimeout);saveTimeout=setTimeout(saveChanges,1000);}
document.getElementById('notice-title').addEventListener('input',scheduleSave);easyMDE.codemirror.on('change',scheduleSave);
<\/script></body></html>`;
}

function expandImageNode(node) {
    document.getElementById('panel-title').textContent = node.fileName || 'Image';
    document.getElementById('panel-iframe').srcdoc = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:20px;background:#1a1a1a;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 5px 20px rgba(0,0,0,0.3)}</style></head>
        <body><img src="${node.fileData}" alt="${node.fileName || 'Image'}"></body></html>`;
}

function expandVideoNode(node) {
    document.getElementById('panel-title').textContent = node.fileName || 'Video';
    document.getElementById('panel-iframe').srcdoc = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{margin:0;padding:20px;background:#1a1a1a;display:flex;justify-content:center;align-items:center;min-height:100vh}.video-container{width:100%;max-width:800px}
        video{width:100%;max-height:90vh;border-radius:8px;box-shadow:0 5px 20px rgba(0,0,0,0.3)}</style></head>
        <body><div class="video-container"><video controls><source src="${node.fileData}" type="${node.fileType}"></video></div></body></html>`;
}

function expandFileNode(node) {
    document.getElementById('panel-title').textContent = node.fileName || 'File';

    if (node.htmlContent) {
        document.getElementById('panel-iframe').srcdoc = node.htmlContent;
        return;
    }

    if (node.fileData) {
        if (node.fileType && node.fileType.startsWith('image/')) {
            document.getElementById('panel-iframe').srcdoc =
                `<html><body style="margin:0;background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${node.fileData}" style="max-width:100%;max-height:100vh"/></body></html>`;
        } else {
            fetch(node.fileData)
                .then(r => r.text())
                .then(text => {
                    document.getElementById('panel-iframe').srcdoc =
                        `<html><body><pre>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body></html>`;
                })
                .catch(() => {
                    document.getElementById('panel-iframe').srcdoc = `<html><body><p>Unable to display file</p></body></html>`;
                });
        }
    } else {
        document.getElementById('panel-iframe').srcdoc = `<html><body><p>No content</p></body></html>`;
    }
}

export function removeNode(id) {
    const connectedEdges = network.getConnectedEdges(id);
    edges.remove(connectedEdges);
    nodes.remove(id);
    const map = getUrlMap();
    for (const url in map) {
        if (map[url] === id) { delete map[url]; break; }
    }
}

export function toggleDetach(id) {
    const node = nodes.get(id);
    if (!node) return;
    if (!node.detached) {
        const connectedEdges = network.getConnectedEdges(id);
        node.detachedEdges = connectedEdges.map(eid => edges.get(eid));
        node.detached = true;
        edges.remove(connectedEdges);
        nodes.update({ id, color: { background: '#9b59b6', border: '#8e44ad', highlight: { background: '#9b59b6', border: '#8e44ad' } } });
    } else {
        if (node.detachedEdges) edges.add(node.detachedEdges);
        node.detached = false;
        node.detachedEdges = null;
        const colors = {
            wikipedia: { background: '#9b59b6', border: '#8e44ad' },
            web: { background: '#1abc9c', border: '#16a085' },
            notice: { background: '#f1c40f', border: '#f39c12' },
            image: { background: '#e67e22', border: '#d35400' },
            video: { background: '#fff', border: '#e74c3c' },
            file: { background: '#fff', border: '#3498db' }
        };
        nodes.update({ id, color: colors[node.type] || { background: '#2c3e50', border: '#34495e' } });
    }
}

export async function editNodeTitle(id) {
    const node = nodes.get(id);
    if (!node) return;
    const currentTitle = node.label || node.noticeData?.title || node.fileName || 'Untitled';
    const newTitle = await showModal('Enter new title', currentTitle);
    if (newTitle !== null && newTitle.trim() !== '') {
        const shortLabel = newTitle.length > 30 ? newTitle.substring(0, 30) + '...' : newTitle;
        if (node.type === 'notice') {
            nodes.update({ id, label: shortLabel, noticeData: { ...node.noticeData, title: newTitle } });
        } else if (node.type === 'web' || node.type === 'file') {
            nodes.update({ id, label: shortLabel });
        }
    }
}