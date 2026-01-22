let currentLang = 'en';

async function parseWikiArticle(url) {
    try {
        const resp = await fetch(`/api/parse?url=${encodeURIComponent(url)}`);
        if (!resp.ok) {
            console.log(`HTTP Error: ${resp.status}`);
            return {
                title: 'Error',
                content: `<p>Failed to fetch article (HTTP ${resp.status})</p>`,
                links: []
            };
        }

        const data = await resp.json();
        if (data.error) {
            console.log(`API Error: ${data.error}`);
            return {
                title: 'Error',
                content: `<p>${data.error}</p>`,
                links: []
            };
        }

        return {
            title: data.title,
            content: data.content,
            links: data.links || []
        };

    } catch (error) {
        console.log('Parse error:', error.message);
        return {
            title: 'Error',
            content: `<p>Failed to load article: ${error.message}</p>`,
            links: []
        };
    }
}


async function getRandomWikiURL() {
    try {
        const langParam = currentLang === 'ru' ? 'ru' : 'en';
        const resp = await fetch(`/api/random?lang=${langParam}`);
        if (!resp.ok) {
            return currentLang === 'ru'
                ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
                : 'https://en.wikipedia.org/wiki/Main_Page';
        }

        const data = await resp.json();
        return data.url || (currentLang === 'ru'
            ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
            : 'https://en.wikipedia.org/wiki/Main_Page');
    } catch (error) {
        return currentLang === 'ru'
            ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
            : 'https://en.wikipedia.org/wiki/Main_Page';
    }
}

function showModal(title, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalOk = document.getElementById('modal-ok');
        const modalCancel = document.getElementById('modal-cancel');
        const modalClose = document.querySelector('.modal-close');

        modalTitle.textContent = title;
        modalInput.value = defaultValue;
        modal.style.display = 'flex';
        setTimeout(() => {
            modalInput.focus();
            modalInput.select();
        }, 100);

        const handleClose = (value) => {
            modal.style.display = 'none';
            modalOk.removeEventListener('click', handleOk);
            modalCancel.removeEventListener('click', handleCancel);
            modalClose.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
            resolve(value);
        };

        const handleOk = () => {
            handleClose(modalInput.value);
        };

        const handleCancel = () => {
            handleClose(null);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };

        modalOk.addEventListener('click', handleOk);
        modalCancel.addEventListener('click', handleCancel);
        modalClose.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('wiki-url');
    const btnGo = document.getElementById('btn-ok');
    const btnRand = document.getElementById('btn-random');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const btnOpenFile = document.getElementById('btn-open-file');
    const fileInput = document.getElementById('file-input');
    const netContainer = document.getElementById('mynetwork');
    const sidePanel = document.getElementById('side-panel');
    const btnClose = document.getElementById('btn-close');
    const panelTitle = document.getElementById('panel-title');
    const panelIframe = document.getElementById('panel-iframe');

    const langSelect = document.getElementById('lang-select');
    const fileUploadInput = document.createElement('input');

    fileUploadInput.type = 'file';
    fileUploadInput.multiple = true;
    fileUploadInput.accept = '*/*';
    fileUploadInput.style.display = 'none';
    document.body.appendChild(fileUploadInput);

    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'context-menu';
    Object.assign(ctxMenu.style, {
        position: 'absolute',
        display: 'none',
        border: '1px solid #333',
        background: '#1a1a1a',
        color: '#e0e0e0',
        padding: '4px',
        zIndex: 9999,
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
    });
    document.body.appendChild(ctxMenu);

    let nodes, edges, network;
    let urlMap = {}, nextId = 0, firstSel = null;
    let activeNodeId = null;

    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', () => {
            currentLang = langSelect.value;
            updatePlaceholder();
        });
    }

    function updatePlaceholder() {
        if (urlInput) {
            urlInput.placeholder = 'Enter URL or path to file';
        }
    }

    function initNetwork() {
        nodes = new vis.DataSet();
        edges = new vis.DataSet();

        const options = {
            nodes: {
                shape: 'box',
                shapeProperties: { borderRadius: 6 },
                color: {
                    background: '#2c3e50',
                    border: '#34495e',
                    highlight: {
                        background: '#3498db',
                        border: '#2980b9'
                    },
                    hover: {
                        background: '#34495e',
                        border: '#2c3e50'
                    }
                },
                borderWidth: 2,
                font: {
                    size: 14,
                    color: '#ecf0f1',
                    face: 'Arial, sans-serif'
                },
                margin: 12,
                widthConstraint: { minimum: 100, maximum: 250 },
                heightConstraint: 40,
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.3)',
                    size: 10,
                    x: 5,
                    y: 5
                }
            },
            edges: {
                color: {
                    color: '#7f8c8d',
                    highlight: '#3498db',
                    hover: '#3498db'
                },
                width: 2,
                smooth: { type: 'continuous' },
                shadow: true,
                arrows: {
                    to: { enabled: false },
                    middle: { enabled: false },
                    from: { enabled: false }
                }
            },
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -100,
                    springLength: 150,
                    springConstant: 0.05,
                    avoidOverlap: 1
                },
                stabilization: {
                    iterations: 500,
                    fit: true
                },
                timestep: 0.5
            },
            interaction: {
                dragNodes: true,
                zoomView: true,
                dragView: true,
                hover: true,
                tooltipDelay: 200,
                multiselect: true
            },
            layout: {
                improvedLayout: true
            }
        };

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
                if (firstSel === null) {
                    firstSel = id;
                    network.selectNodes([id]);
                } else if (firstSel !== id) {
                    const existingEdge = edges.get({
                        filter: e => (e.from === firstSel && e.to === id) ||
                            (e.from === id && e.to === firstSel)
                    }).length;

                    if (!existingEdge) {
                        edges.add({ from: firstSel, to: id });
                    }
                    network.unselectAll();
                    firstSel = null;
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
                        const pos = network.DOMtoCanvas({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                        });

                        if (type === 'notice') {
                            addNoticeNode(pos.x, pos.y, title);
                        } else if (url) {
                            const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';
                            if (nodeType === 'web') {
                                const title = await showModal(
                                    'Enter title for the web page',
                                    decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
                                );
                                if (title !== null) {
                                    addSingleNode(url, pos.x, pos.y, title, nodeType);
                                }
                            } else {
                                addSingleNode(url, pos.x, pos.y, null, nodeType);
                            }
                        }
                    } catch (error) {
                        console.log('Drop error:', error);
                    }
                } else {
                    const url = e.dataTransfer.getData('text/uri-list') ||
                        e.dataTransfer.getData('text/plain');
                    if (url && (isValidUrl(url) || isValidFilePath(url))) {
                        const rect = netContainer.getBoundingClientRect();
                        const pos = network.DOMtoCanvas({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                        });
                        const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';

                        if (nodeType === 'web') {
                            const title = await showModal(
                                'Enter title for the web page',
                                decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
                            );
                            if (title !== null) {
                                addSingleNode(url, pos.x, pos.y, title, nodeType);
                            }
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
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            const id = network.getNodeAt(pos);

            if (ctxMenu.style.display === 'block') {
                ctxMenu.style.display = 'none';
                return;
            }

            if (id !== undefined) {
                showNodeMenu(e.pageX, e.pageY, id);
            } else {
                showCanvasMenu(e.pageX, e.pageY);
            }
        });

        document.addEventListener('click', hideMenu);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideMenu();
        });
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function isValidFilePath(string) {
        return string && (string.includes('/') || string.includes('\\') || string.includes('.'));
    }

    function showNodeMenu(x, y, id) {
        ctxMenu.innerHTML = '';

        const node = nodes.get(id);
        const actions = [
            { text: 'Open', icon: 'fas fa-external-link-alt', action: () => expandNode(id) },
            { text: 'Delete', icon: 'fas fa-trash', action: () => removeNode(id) },
            { text: 'Detach', icon: 'fas fa-unlink', action: () => toggleDetach(id) }
        ];

        if (node.type === 'web' || node.type === 'notice' || node.type === 'file') {
            actions.splice(1, 0, { text: 'Edit Title', icon: 'fas fa-edit', action: () => editNodeTitle(id) });
        }

        actions.forEach(item => {
            const div = document.createElement('div');
            div.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
            div.style.padding = '10px 15px';
            div.style.cursor = 'pointer';
            div.style.color = '#e0e0e0';
            div.style.borderBottom = '1px solid #333';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '10px';

            div.addEventListener('mouseenter', () => {
                div.style.background = 'rgba(52, 152, 219, 0.2)';
                div.style.color = '#fff';
            });

            div.addEventListener('mouseleave', () => {
                div.style.background = '';
                div.style.color = '#e0e0e0';
            });

            div.onclick = () => {
                hideMenu();
                item.action();
            };

            ctxMenu.appendChild(div);
        });

        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top = y + 'px';
        ctxMenu.style.display = 'block';
    }

    async function editNodeTitle(id) {
        const node = nodes.get(id);
        if (!node) return;

        const currentTitle = node.label ||
            (node.noticeData?.title) ||
            (node.fileName) ||
            'Untitled';

        const newTitle = await showModal(
            'Enter new title',
            currentTitle
        );

        if (newTitle !== null && newTitle.trim() !== '') {
            const shortLabel = newTitle.length > 30 ? newTitle.substring(0, 30) + '...' : newTitle;

            if (node.type === 'notice') {
                nodes.update({
                    id,
                    label: shortLabel,
                    noticeData: {
                        ...node.noticeData,
                        title: newTitle
                    }
                });
            } else if (node.type === 'web' || node.type === 'file') {
                nodes.update({
                    id,
                    label: shortLabel
                });
            }
        }
    }

    function showCanvasMenu(x, y) {
        ctxMenu.innerHTML = '';

        const webDiv = document.createElement('div');
        webDiv.innerHTML = '<i class="fas fa-globe"></i> Add Web Page';
        webDiv.style.padding = '10px 15px';
        webDiv.style.cursor = 'pointer';
        webDiv.style.color = '#e0e0e0';
        webDiv.style.borderBottom = '1px solid #333';
        webDiv.style.display = 'flex';
        webDiv.style.alignItems = 'center';
        webDiv.style.gap = '10px';
        webDiv.onclick = () => {
            const rect = netContainer.getBoundingClientRect();
            const pos = network.DOMtoCanvas({
                x: x - rect.left,
                y: y - rect.top
            });

            showModal('Enter URL', 'https://')
                .then(url => {
                    if (url && isValidUrl(url)) {
                        const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';

                        if (nodeType === 'web') {
                            showModal(
                                'Enter title for the web page',
                                decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
                            ).then(title => {
                                if (title !== null) {
                                    addSingleNode(url, pos.x, pos.y, title, nodeType);
                                }
                            });
                        } else {
                            addSingleNode(url, pos.x, pos.y, null, nodeType);
                        }
                    }
                });
            hideMenu();
        };
        ctxMenu.appendChild(webDiv);

        const noticeDiv = document.createElement('div');
        noticeDiv.innerHTML = '<i class="fas fa-sticky-note"></i> Add Notice';
        noticeDiv.style.padding = '10px 15px';
        noticeDiv.style.cursor = 'pointer';
        noticeDiv.style.color = '#e0e0e0';
        noticeDiv.style.borderBottom = '1px solid #333';
        noticeDiv.style.display = 'flex';
        noticeDiv.style.alignItems = 'center';
        noticeDiv.style.gap = '10px';
        noticeDiv.onclick = () => {
            const rect = netContainer.getBoundingClientRect();
            const pos = network.DOMtoCanvas({
                x: x - rect.left,
                y: y - rect.top
            });

            showModal(
                'Enter notice title',
                'New notice'
            ).then(title => {
                if (title !== null) {
                    addNoticeNode(pos.x, pos.y, title || ('New notice'));
                }
            });
            hideMenu();
        };
        ctxMenu.appendChild(noticeDiv);

        const fileDiv = document.createElement('div');
        fileDiv.innerHTML = '<i class="fas fa-file-upload"></i> Upload Files';
        fileDiv.style.padding = '10px 15px';
        fileDiv.style.cursor = 'pointer';
        fileDiv.style.color = '#e0e0e0';
        fileDiv.style.display = 'flex';
        fileDiv.style.alignItems = 'center';
        fileDiv.style.gap = '10px';
        fileDiv.onclick = () => {
            fileUploadInput.click();
            hideMenu();
        };
        ctxMenu.appendChild(fileDiv);

        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top = y + 'px';
        ctxMenu.style.display = 'block';
    }

    function hideMenu() {
        ctxMenu.style.display = 'none';
    }

    async function handleFileUpload(file, clientX, clientY) {
        const rect = netContainer.getBoundingClientRect();
        const pos = network.DOMtoCanvas({
            x: clientX - rect.left,
            y: clientY - rect.top
        });

        const isExecutable = file.name.match(/\.(exe|bat|cmd|sh|msi|dmg|app|jar|pkg)$/i);
        if (isExecutable) {
            alert('Executable files are not allowed for security reasons.');
            return;
        }

        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
    
        const reader = new FileReader();
        
        if (isImage || isVideo) {
            reader.readAsDataURL(file);
            
            reader.onload = async (e) => {
                const data = e.target.result;
                const id = nextId++;

                if (isImage) {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const maxSize = 200;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > maxSize) {
                                height = (height * maxSize) / width;
                                width = maxSize;
                            }
                        } else {
                            if (height > maxSize) {
                                width = (width * maxSize) / height;
                                height = maxSize;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

                        nodes.add({
                            id,
                            label: '',
                            type: 'image',
                            fileData: data,
                            fileName: file.name,
                            fileType: file.type,
                            thumbnail: thumbnail,
                            x: pos.x,
                            y: pos.y,
                            shape: 'image',
                            image: thumbnail,
                            size: Math.max(width, height) / 10 + 40,
                            color: {
                                background: '#e67e22',
                                border: '#d35400',
                                highlight: { background: '#e67e22', border: '#d35400' }
                            }
                        });
                    };
                    img.src = data;
                } else if (isVideo) {
                    nodes.add({
                        id,
                        label: file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name,
                        type: 'video',
                        fileData: data,
                        fileName: file.name,
                        fileType: file.type,
                        x: pos.x,
                        y: pos.y,
                        shape: 'icon',
                        icon: {
                            face: 'FontAwesome',
                            code: '📼',
                            color: '#3ca3e7',
                            size: 60
                        },
                        color: {
                            background: '#fff',
                            border: '#e74c3c',
                            highlight: { background: '#fff', border: '#e74c3c' }
                        }
                    });
                }
            };
        } else {
            reader.readAsDataURL(file);
            
            reader.onload = async (e) => {
                const data = e.target.result;
                const id = nextId++;
                
                let iconCode = '📄';
                let iconColor = '#3498db';
                
                if (file.name.match(/\.pdf$/i)) {
                    iconCode = '📕';
                    iconColor = '#e74c3c';
                } else if (file.name.match(/\.(txt|md)$/i)) {
                    iconCode = '📝';
                    iconColor = '#2ecc71';
                } else if (file.name.match(/\.(doc|docx)$/i)) {
                    iconCode = '📘';
                    iconColor = '#3498db';
                } else if (file.name.match(/\.(xls|xlsx)$/i)) {
                    iconCode = '📗';
                    iconColor = '#27ae60';
                } else if (file.name.match(/\.(ppt|pptx)$/i)) {
                    iconCode = '📙';
                    iconColor = '#f39c12';
                }

                nodes.add({
                    id,
                    label: file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name,
                    type: 'file',
                    fileData: data,
                    fileName: file.name,
                    fileType: file.type,
                    x: pos.x,
                    y: pos.y,
                    shape: 'icon',
                    icon: {
                        face: 'FontAwesome',
                        code: iconCode,
                        color: iconColor,
                        size: 60
                    },
                    color: {
                        background: '#fff',
                        border: iconColor,
                        highlight: { background: '#fff', border: iconColor }
                    }
                });
            };
        }
    }

    fileUploadInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const rect = netContainer.getBoundingClientRect();
        const centerPos = network.DOMtoCanvas({
            x: rect.width / 2,
            y: rect.height / 2
        });

        files.forEach((file, index) => {
            setTimeout(() => {
                handleFileUpload(file,
                    rect.left + rect.width / 2 + (index * 30),
                    rect.top + rect.height / 2 + (index * 30)
                );
            }, index * 100);
        });

        fileUploadInput.value = '';
    });

    function addSingleNode(url, x, y, customTitle = null, type = 'wikipedia') {
        try {
            if (urlMap[url]) {
                console.log('Node already exists:', url);
                return;
            }

            const id = nextId++;
            urlMap[url] = id;

            let title = customTitle;
            if (!title) {
                try {
                    title = decodeURIComponent(url.split('/').pop())
                        .replace(/_/g, ' ')
                        .replace(/%20/g, ' ');
                } catch (e) {
                    title = type === 'wikipedia' ?
                        ('Wikipedia Article') :
                        ('Web Page');
                }
            }

            const shortLabel = title.length > 30 ? title.substring(0, 30) + '...' : title;

            const color = type === 'wikipedia' ? {
                background: '#9b59b6',
                border: '#8e44ad',
                highlight: { background: '#9b59b6', border: '#8e44ad' }
            } : {
                background: '#1abc9c',
                border: '#16a085',
                highlight: { background: '#1abc9c', border: '#16a085' }
            };

            nodes.add({
                id,
                label: shortLabel,
                url: url,
                type: type,
                x: x,
                y: y,
                color: color
            });

            console.log('Node added:', url, title);

        } catch (error) {
            console.log('Add node error:', error);
        }
    }

    function addNoticeNode(x, y, title = 'New notice') {
        const id = nextId++;
        let shortLabel = title.length > 30 ? title.substring(0, 30) + '...' : title;

        nodes.add({
            id,
            label: shortLabel,
            type: 'notice',
            noticeData: {
                title: title,
                content: '',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            },
            x: x,
            y: y,
            color: {
                background: '#f1c40f',
                border: '#f39c12',
                highlight: { background: '#f1c40f', border: '#f39c12' },
                font: {
                    color: '#000000'
                }
            },
            font: {
                color: '#000000'
            }
        });

        setTimeout(() => expandNode(id), 100);
    }

    async function expandNode(id) {
        const node = nodes.get(id);
        if (!node) return;

        activeNodeId = id;
        panelTitle.textContent = 'Loading...';
        sidePanel.classList.add('open');

        switch (node.type) {
            case 'wikipedia':
                await expandWikipediaNode(node);
                break;
            case 'web':
                await expandWebNode(node);
                break;
            case 'notice':
                expandNoticeNode(node);
                break;
            case 'image':
                expandImageNode(node);
                break;
            case 'video':
                expandVideoNode(node);
                break;
            case 'file':
                expandFileNode(node);
                break;
            default:
                panelIframe.srcdoc = `<html><body><p>Unknown node type</p></body></html>`;
        }
    }

    async function expandWikipediaNode(node) {
        const { title, content } = await parseWikiArticle(node.url);
        panelTitle.textContent = title;

        const shortTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
        nodes.update({ id: node.id, label: shortTitle });

        panelIframe.srcdoc = content;
    }

    async function expandWebNode(node) {
        try {
            const { title, content } = await parseWebPage(node.url);
            panelTitle.textContent = title || node.label;

            panelIframe.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                        }
                        iframe {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            border: none;
                        }
                    </style>
                </head>
                <body>
                    <iframe src="${node.url}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
                </body>
                </html>
            `;
        } catch (error) {
            panelTitle.textContent = node.label || ('Web Page');
            panelIframe.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            overflow: hidden;
                        }
                        iframe {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            border: none;
                        }
                    </style>
                </head>
                <body>
                    <iframe src="${node.url}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
                </body>
                </html>
            `;
        }
    }

    function expandNoticeNode(node) {
        panelTitle.textContent = 'Notice Editor';
        const noticeData = node.noticeData || {
            title: 'New notice',
            content: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        panelIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #1a1a1a; 
                        color: #e0e0e0; 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    }
                    input, textarea { 
                        width: 100%; 
                        padding: 12px; 
                        margin-bottom: 15px; 
                        background: #2a2a2a; 
                        color: #fff; 
                        border: 1px solid #444; 
                        border-radius: 6px; 
                        box-sizing: border-box;
                        font-size: 14px;
                    }
                    input:focus, textarea:focus {
                        outline: none;
                        border-color: #3498db;
                        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
                    }
                    textarea { 
                        height: 400px; 
                        resize: vertical; 
                        font-family: monospace;
                    }
                    button { 
                        padding: 12px 24px; 
                        background: #3498db; 
                        color: white; 
                        border: none; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        font-size: 14px;
                        font-weight: 500;
                    }
                    button:hover {
                        background: #2980b9;
                    }
                    .info {
                        font-size: 12px;
                        color: #95a5a6;
                        margin-top: 15px;
                        padding-top: 15px;
                        border-top: 1px solid #333;
                    }
                </style>
            </head>
            <body>
                <input type="text" id="notice-title" value="${noticeData.title}" placeholder="Title">
                <textarea id="notice-content" placeholder="Write your note here...">${noticeData.content}</textarea>
                <button onclick="saveNotice()">Save</button>
                <div class="info">
                    Created: ${new Date(noticeData.created).toLocaleString()}<br>
                    Last updated: ${new Date(noticeData.updated).toLocaleString()}
                </div>
                <script>
                    function saveNotice() {
                        const title = document.getElementById('notice-title').value;
                        const content = document.getElementById('notice-content').value;
                        
                        window.parent.postMessage({
                            type: 'notice-update',
                            data: {
                                id: ${node.id},
                                title: title,
                                content: content
                            }
                        }, '*');
                    }
                    
                    let saveTimeout;
                    function scheduleSave() {
                        clearTimeout(saveTimeout);
                        saveTimeout = setTimeout(saveNotice, 1000);
                    }
                    
                    document.getElementById('notice-title').addEventListener('input', scheduleSave);
                    document.getElementById('notice-content').addEventListener('input', scheduleSave);
                </script>
            </body>
            </html>
        `;
    }

    function expandImageNode(node) {
        panelTitle.textContent = node.fileName || 'Image';
        panelIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #1a1a1a; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        min-height: 100vh; 
                    }
                    img { 
                        max-width: 100%; 
                        max-height: 90vh; 
                        border-radius: 8px; 
                        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                    }
                    .info {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background: rgba(0,0,0,0.8);
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        color: white;
                    }
                </style>
            </head>
            <body>
                <div class="info">${node.fileName || 'Image'}</div>
                <img src="${node.fileData}" alt="${node.fileName || 'Image'}">
            </body>
            </html>
        `;
    }

    function expandVideoNode(node) {
        panelTitle.textContent = node.fileName || 'Video';
        panelIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #1a1a1a; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        min-height: 100vh; 
                    }
                    .video-container {
                        width: 100%;
                        max-width: 800px;
                    }
                    video { 
                        width: 100%; 
                        max-height: 90vh; 
                        border-radius: 8px; 
                        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                    }
                    .info {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background: rgba(0,0,0,0.8);
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        color: white;
                    }
                </style>
            </head>
            <body>
                <div class="info">${node.fileName || 'Video'}</div>
                <div class="video-container">
                    <video controls>
                        <source src="${node.fileData}" type="${node.fileType}">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </body>
            </html>
        `;
    }

    function expandFileNode(node) {
        panelTitle.textContent = node.fileName || 'File';
        panelIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background: #1a1a1a;
                    }
                    iframe {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                    .file-info {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background: rgba(0,0,0,0.8);
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        color: white;
                        z-index: 1000;
                    }
                </style>
            </head>
            <body>
                <div class="file-info">
                    ${node.fileName || 'File'} (${node.fileType || 'Unknown type'})
                </div>
                <iframe src="${node.fileData}"></iframe>
            </body>
            </html>
        `;
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'notice-update' && activeNodeId !== null) {
            const node = nodes.get(activeNodeId);
            if (node && node.type === 'notice') {
                const newData = {
                    ...node.noticeData,
                    title: event.data.data.title,
                    content: event.data.data.content,
                    updated: new Date().toISOString()
                };

                nodes.update({
                    id: activeNodeId,
                    noticeData: newData,
                    label: event.data.data.title.length > 30 ?
                        event.data.data.title.substring(0, 30) + '...' :
                        event.data.data.title
                });
            }
        }
    });

    function removeNode(id) {
        const connectedEdges = network.getConnectedEdges(id);
        edges.remove(connectedEdges);
        nodes.remove(id);

        for (const url in urlMap) {
            if (urlMap[url] === id) {
                delete urlMap[url];
                break;
            }
        }
    }

    function toggleDetach(id) {
        const node = nodes.get(id);
        if (!node) return;

        if (!node.detached) {
            const connectedEdges = network.getConnectedEdges(id);
            const edgeData = connectedEdges.map(eid => edges.get(eid));

            node.detachedEdges = edgeData;
            node.detached = true;
            edges.remove(connectedEdges);

            nodes.update({
                id,
                color: {
                    background: '#e74c3c',
                    border: '#c0392b',
                    highlight: { background: '#e74c3c', border: '#c0392b' }
                }
            });
        } else {
            if (node.detachedEdges) {
                edges.add(node.detachedEdges);
            }
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

            nodes.update({
                id,
                color: colors[node.type] || {
                    background: '#2c3e50',
                    border: '#34495e'
                }
            });
        }
    }

    btnGo.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL or file path');
            return;
        }

        if (url.startsWith('file://') || url.includes('\\') || (url.includes('/') && !url.includes('://'))) {
            alert('For local files, please use the "Upload Files" button or drag and drop files directly onto the graph.');
            return;
        }

        if (!isValidUrl(url)) {
            alert('Please enter a valid URL');
            return;
        }

        const nodeType = url.includes('wikipedia.org') ? 'wikipedia' : 'web';

        let title = null;
        if (nodeType === 'web') {
            title = await showModal('Enter title for the web page',
                decodeURIComponent(url.split('/').pop() || 'Web Page').replace(/_/g, ' ')
            );
            if (title === null) return;
        }

        nodes.clear();
        edges.clear();
        urlMap = {};
        nextId = 0;
        firstSel = null;

        const rootId = nextId++;
        urlMap[url] = rootId;

        const color = nodeType === 'wikipedia' ? {
            background: '#3498db',
            border: '#2980b9',
            highlight: { background: '#3498db', border: '#2980b9' }
        } : {
            background: '#1abc9c',
            border: '#16a085',
            highlight: { background: '#1abc9c', border: '#16a085' }
        };

        nodes.add({
            id: rootId,
            label: title || '...',
            url: url,
            type: nodeType,
            color: color
        });

        await expandNode(rootId);
    });

    btnRand.addEventListener('click', async () => {
        try {
            const randomUrl = await getRandomWikiURL();
            urlInput.value = randomUrl;

            nodes.clear();
            edges.clear();
            urlMap = {};
            nextId = 0;
            firstSel = null;

            const rootId = nextId++;
            urlMap[randomUrl] = rootId;

            nodes.add({
                id: rootId,
                label: '...',
                url: randomUrl,
                type: 'wikipedia',
                color: {
                    background: '#9b59b6',
                    border: '#8e44ad',
                    highlight: { background: '#9b59b6', border: '#8e44ad' }
                }
            });

            await expandNode(rootId);
        } catch (error) {
            console.log('Random error:', error);
        }
    });

    if (btnOpenFile) {
        btnOpenFile.addEventListener('click', () => {
            fileUploadInput.click();
        });
    }

    btnSave.addEventListener('click', () => {
        const graph = {
            nodes: nodes.get().map(node => {
                const { id, label, type, url, noticeData, fileData, fileName, fileType, thumbnail, x, y, color, shape, icon, image, size } = node;
                return { id, label, type, url, noticeData, fileData, fileName, fileType, thumbnail, x, y, color, shape, icon, image, size };
            }),
            edges: edges.get(),
            metadata: {
                savedAt: new Date().toISOString(),
                version: '3.2',
                nodeCount: nodes.length,
                edgeCount: edges.length,
                language: currentLang
            }
        };

        const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wiki-graph-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    btnLoad.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.nodes || !data.edges) {
                alert('Invalid graph file');
                return;
            }

            nodes.clear();
            edges.clear();
            urlMap = {};
            nextId = 0;
            firstSel = null;

            if (data.metadata && data.metadata.language) {
                currentLang = data.metadata.language;
                if (langSelect) {
                    langSelect.value = currentLang;
                }
                updatePlaceholder();
            }

            data.nodes.forEach(node => {
                if (node.url && (node.type === 'wikipedia' || node.type === 'web')) {
                    urlMap[node.url] = node.id;
                }
                nextId = Math.max(nextId, node.id + 1);
                nodes.add(node);
            });

            edges.add(data.edges);

            network.fit();
            console.log('Graph loaded successfully:', data.nodes.length, 'nodes');

        } catch (error) {
            console.log('Load error:', error);
            alert('Error loading file: ' + error.message);
        }

        fileInput.value = '';
    });

    btnClose.addEventListener('click', () => {
        sidePanel.classList.remove('open');
        panelIframe.srcdoc = '';
        panelTitle.textContent = '';
        activeNodeId = null;
    });

    updatePlaceholder();
    initNetwork();
});