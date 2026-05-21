export function showModal(title, defaultValue = '') {
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
        const handleOk = () => handleClose(modalInput.value);
        const handleCancel = () => handleClose(null);
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

export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

export function isValidFilePath(string) {
    return string && (string.includes('/') || string.includes('\\') || string.includes('.'));
}

export function updatePlaceholder() {
    const searchInput = document.getElementById('wiki-search');
    if (searchInput) searchInput.placeholder = 'Search';
}