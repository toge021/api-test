const API_URL = 'https://api.togehost.online/api/upload';
const API_KEY = 'inumaki';

// Éléments
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressWrapper = document.getElementById('progressWrapper');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const results = document.getElementById('results');
const historyList = document.getElementById('historyList');

// État
let uploadCount = 0;
const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');

// Affiche l'historique
function renderHistory() {
    historyList.innerHTML = '';
    history.slice(-10).reverse().forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${item.name}</span><a href="${item.url}" target="_blank" class="h-link">${item.url}</a>`;
        historyList.appendChild(li);
    });
}
renderHistory();

// Toast
function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Copier
function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('✅ Lien copié !'));
    } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        showToast('✅ Lien copié !');
    }
}

// Upload
async function uploadFiles(files) {
    const formData = new FormData();

    if (files.length === 1) {
        formData.append('file', files[0]);
    } else {
        for (const file of files) {
            formData.append('files', file);
        }
    }

    progressWrapper.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    try {
        const xhr = new XMLHttpRequest();

        const promise = new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = pct + '%';
                    progressText.textContent = pct + '%';
                }
            });

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Erreur réseau'));
        });

        xhr.open('POST', API_URL);
        xhr.setRequestHeader('X-API-Key', API_KEY);
        xhr.send(formData);

        const data = await promise;
        displayResults(data, files);

    } catch (err) {
        showToast('❌ Erreur : ' + err.message);
    } finally {
        setTimeout(() => {
            progressWrapper.classList.add('hidden');
        }, 500);
    }
}

// Afficher les résultats
function displayResults(data, files) {
    results.innerHTML = '';

    if (data.success && data.fullUrl) {
        // Upload unique
        const card = createResultCard(data, files[0]);
        results.appendChild(card);
        addHistory(data.fullUrl, files[0].name);

    } else if (data.success && data.results) {
        // Upload multi
        data.results.forEach((item, i) => {
            if (item.success) {
                const card = createResultCard(item, files[i]);
                results.appendChild(card);
                addHistory(item.fullUrl, files[i].name);
            }
        });
        if (data.errors?.length) {
            showToast(`⚠️ ${data.errors.length} fichier(s) en échec`);
        }
    } else {
        showToast('❌ ' + (data.error || 'Échec de l\'upload'));
    }
}

// Créer une carte résultat
function createResultCard(data, file) {
    const div = document.createElement('div');
    div.className = 'result-card';

    const isImage = file?.type?.startsWith('image/');

    div.innerHTML = `
        ${isImage ? `<img src="${data.fullUrl}" alt="${data.originalName}" />` : '<div style="width:60px;height:60px;border-radius:12px;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📄</div>'}
        <div class="result-info">
            <div class="filename">${data.originalName || file?.name || 'fichier'}</div>
            <div class="size">${formatSize(data.fileSize || file?.size || 0)}</div>
            <a href="${data.fullUrl}" target="_blank" class="result-link">${data.fullUrl}</a>
        </div>
        <button class="copy-btn" data-url="${data.fullUrl}">📋 Copier</button>
    `;

    div.querySelector('.copy-btn').addEventListener('click', () => {
        copyText(data.fullUrl);
    });

    return div;
}

// Format taille
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
}

// Historique
function addHistory(url, name) {
    history.push({ url, name, time: Date.now() });
    if (history.length > 50) history.shift();
    localStorage.setItem('uploadHistory', JSON.stringify(history));
    renderHistory();
}

// --- Événements ---

// Click sur la zone de drop
dropZone.addEventListener('click', (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        uploadFiles(Array.from(fileInput.files));
        fileInput.value = '';
    }
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
        uploadFiles(files);
    }
});

// Coller depuis le presse-papier
document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) files.push(file);
        }
    }

    if (files.length) {
        uploadFiles(files);
        showToast(`📸 ${files.length} image(s) collée(s)`);
    }
});