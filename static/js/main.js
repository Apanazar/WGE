import { initNetwork } from './network.js';
import { initUI } from './ui.js';
import { nodes } from './network.js';
import { getActiveNodeId } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    initNetwork();
    initUI();

    window.addEventListener('message', (event) => {
        if (event.data.type === 'notice-update') {
            const activeId = getActiveNodeId();
            if (activeId !== null) {
                const node = nodes.get(activeId);
                if (node && node.type === 'notice') {
                    const newData = {
                        ...node.noticeData,
                        title: event.data.data.title,
                        content: event.data.data.content,
                        updated: new Date().toISOString()
                    };
                    nodes.update({
                        id: activeId,
                        noticeData: newData,
                        label: event.data.data.title.length > 30 ?
                            event.data.data.title.substring(0, 30) + '...' : event.data.data.title
                    });
                }
            }
        }
    });
});