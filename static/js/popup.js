document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-explore');
    btn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    });
});
