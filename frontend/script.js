// Global State
let currentThreadId = null;
let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
let userSettings = JSON.parse(localStorage.getItem('userSettings')) || {
    name: 'Mohsinart2',
    email: 'mohsinart2@gmail.com',
    avatar: 'https://ui-avatars.com/api/?name=Mohsinart2&background=2563eb&color=fff'
};

// Modal Templates
const getModals = () => ({
    settings: `
        <div class="flex justify-between items-center mb-8">
            <h2 class="text-2xl font-bold">Settings</h2>
            <i class="fas fa-times cursor-pointer text-muted hover:text-white" onclick="closeModal()"></i>
        </div>
        <div class="flex space-x-8">
            <aside class="w-48 space-y-2">
                <div class="p-3 bg-accent/10 border-l-2 border-accent text-accent text-sm font-bold rounded-r-lg">Profile</div>
                <div class="p-3 text-muted hover:text-white text-sm font-bold cursor-pointer transition">Appearance</div>
                <div class="p-3 text-muted hover:text-white text-sm font-bold cursor-pointer transition">Data & Keys</div>
            </aside>
            <div class="flex-1 space-y-6">
                <div>
                    <label class="block text-xs font-bold text-muted uppercase mb-2">Display Name</label>
                    <input type="text" id="settings-name" value="${userSettings.name}" class="w-full bg-input border border-slate-800 rounded-xl py-3 px-4 text-sm focus:border-accent outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-muted uppercase mb-2">Email Address</label>
                    <input type="email" id="settings-email" value="${userSettings.email}" class="w-full bg-input border border-slate-800 rounded-xl py-3 px-4 text-sm focus:border-accent outline-none">
                </div>
                <div class="pt-4 border-t border-slate-800 flex justify-end">
                    <button class="bg-accent px-6 py-2.5 rounded-xl font-bold hover:bg-accent/90 transition" onclick="saveSettings()">Save Changes</button>
                </div>
            </div>
        </div>
    `,
    search: `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">Search Threads</h2>
            <i class="fas fa-times cursor-pointer text-muted hover:text-white" onclick="closeModal()"></i>
        </div>
        <div class="mb-6">
            <div class="relative">
                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
                <input type="text" placeholder="Search conversations..." autofocus 
                    class="w-full bg-input border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none"
                    oninput="window.filterThreads(this.value)">
            </div>
        </div>
        <p class="text-[10px] text-muted font-bold uppercase tracking-widest mb-4">Sidebar History</p>
        <div id="search-results" class="space-y-2 px-2 text-sm text-muted italic">
            Type to start filtering history...
        </div>
    `,
    menu: `
        <div class="space-y-4">
            <div class="flex items-center space-x-4 p-4 hover:bg-slate-800 rounded-2xl cursor-pointer transition" onclick="window.clearConversation(); closeModal();">
                <i class="fas fa-trash text-red-500"></i>
                <div>
                    <p class="text-sm font-bold text-white">Clear current thread</p>
                    <p class="text-[10px] text-muted">Permanently delete this chat</p>
                </div>
            </div>
            <div class="flex items-center space-x-4 p-4 hover:bg-slate-800 rounded-2xl cursor-pointer transition" onclick="window.exportChat(); closeModal();">
                <i class="fas fa-file-export text-accent"></i>
                <div>
                    <p class="text-sm font-bold text-white">Export chat</p>
                    <p class="text-[10px] text-muted">Download as Markdown</p>
                </div>
            </div>
        </div>
    `
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateProfileUI();
    renderHistory();
    
    // Auto-start a thread if history is empty or load the last one
    if (chatHistory.length > 0) {
        switchThread(chatHistory[0].id);
    } else {
        newThread();
    }

    const textarea = document.getElementById('user-input');
    if (textarea) {
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
    }

    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                addSystemMessage(`Attached: ${fileName}`);
            }
        });
    }
    // Configure Marked
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        breaks: true,
        gfm: true
    });
});

function updateProfileUI() {
    document.getElementById('user-name').textContent = userSettings.name;
    document.getElementById('user-email').textContent = userSettings.email;
    document.getElementById('user-avatar').src = userSettings.avatar;
    const welcomeName = document.getElementById('welcome-name');
    if (welcomeName) welcomeName.textContent = userSettings.name.split(' ')[0];
}

window.saveSettings = () => {
    const name = document.getElementById('settings-name').value;
    const email = document.getElementById('settings-email').value;
    userSettings.name = name;
    userSettings.email = email;
    userSettings.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`;
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    updateProfileUI();
    closeModal();
};

// Modal Logic
window.showModal = (modalId) => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    content.innerHTML = getModals()[modalId];
    setTimeout(() => content.classList.remove('scale-95'), 10);
};

window.showSearch = () => window.showModal('search');
window.showMenu = () => window.showModal('menu');

window.filterThreads = (query) => {
    const list = document.getElementById('thread-history-container');
    const results = document.getElementById('search-results');
    if (!list || !results) return;

    const filtered = chatHistory.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));
    
    if (query.trim() === '') {
        results.innerHTML = 'Type to start filtering history...';
        return;
    }

    if (filtered.length === 0) {
        results.innerHTML = 'No matching threads found.';
    } else {
        results.innerHTML = '';
        filtered.forEach(thread => {
            const resultItem = document.createElement('div');
            resultItem.className = "p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition flex items-center space-x-3 text-white not-italic mb-1";
            resultItem.innerHTML = `
                <i class="far fa-comment-alt text-accent"></i>
                <span class="text-sm font-medium">${thread.title}</span>
            `;
            resultItem.onclick = () => {
                window.switchThread(thread.id);
                closeModal();
            };
            results.appendChild(resultItem);
        });
    }
};

window.closeModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    if (!content) return;
    
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
};

// History Management
function renderHistory() {
    const container = document.getElementById('thread-history-container');
    if (!container) return;
    
    container.innerHTML = `<p class="text-[10px] text-muted font-bold uppercase tracking-widest mb-4 ml-2">History</p>`;
    
    chatHistory.forEach(thread => {
        const div = document.createElement('div');
        const isActive = thread.id === currentThreadId;
        div.className = `${isActive ? 'sidebar-item-active' : 'p-3 hover:bg-slate-800 text-muted'} p-3 rounded-xl flex items-center space-x-3 cursor-pointer group transition mb-1`;
        div.innerHTML = `
            <i class="${isActive ? 'far fa-comment-alt text-accent' : 'fas fa-history group-hover:text-white'}"></i>
            <span class="text-sm font-medium ${isActive ? 'text-white' : 'group-hover:text-white'} truncate">${thread.title}</span>
        `;
        div.onclick = () => switchThread(thread.id);
        container.appendChild(div);
    });
}

window.newThread = () => {
    currentThreadId = Date.now().toString();
    const newThreadObj = {
        id: currentThreadId,
        title: 'New Chat',
        messages: []
    };
    chatHistory.unshift(newThreadObj); // Add to beginning
    saveHistory();
    renderHistory();
    renderMessages();
};

window.switchThread = (id) => {
    currentThreadId = id;
    renderHistory();
    renderMessages();
};

function saveHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function renderMessages() {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    const thread = chatHistory.find(t => t.id === currentThreadId);
    if (!thread) return;

    container.innerHTML = `
        <div class="text-center py-4">
            <span class="text-[10px] text-muted font-bold uppercase tracking-[0.2em]">${new Date(parseInt(thread.id)).toLocaleDateString()}</span>
        </div>
    `;

    if (thread.messages.length === 0) {
        addAIMessage(`Hello **${userSettings.name.split(' ')[0]}**! 👋 I'm your AI assistant for Nexus Electro Pakistan. How can I help you today?`, false);
    } else {
        thread.messages.forEach(msg => {
            if (msg.role === 'user') {
                addUserMessageToUI(msg.content);
            } else {
                addAIMessageToUI(msg.content);
            }
        });
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

// Chat UI Helpers
function addUserMessageToUI(content) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = "flex justify-end space-x-6 message-bubble";
    div.innerHTML = `
        <div class="flex-1 max-w-2xl text-right">
            <div class="bg-accent p-6 rounded-2xl rounded-tr-none text-white leading-relaxed inline-block text-left shadow-lg shadow-accent/20">
                ${content}
            </div>
        </div>
        <div class="w-10 h-10 bg-slate-800 rounded-xl flex-shrink-0 flex items-center justify-center border border-slate-700">
             <img src="${userSettings.avatar}" class="w-10 h-10 rounded-xl" alt="User">
        </div>
    `;
    container.appendChild(div);
}

function addAIMessageToUI(content) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = "flex space-x-6 max-w-4xl message-bubble";
    
    // Parse markdown content
    const htmlContent = marked.parse(content);
    
    div.innerHTML = `
        <div class="w-10 h-10 bg-accent rounded-xl flex-shrink-0 flex items-center justify-center">
            <i class="fas fa-robot text-white"></i>
        </div>
        <div class="flex-1 space-y-4">
            <div class="glass-card p-6 rounded-2xl rounded-tl-none leading-relaxed text-slate-200 markdown-content">
                ${htmlContent}
            </div>
        </div>
    `;
    container.appendChild(div);
    
    // Highlight any code blocks in the newly added message
    div.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

function addSystemMessage(text) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    div.className = "flex justify-center my-4";
    div.innerHTML = `<span class="text-[10px] bg-slate-800 text-muted px-3 py-1 rounded-full border border-slate-700">${text}</span>`;
    container.appendChild(div);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function addAIMessage(content, save = true) {
    addAIMessageToUI(content);
    if (save) {
        const thread = chatHistory.find(t => t.id === currentThreadId);
        if (thread) {
            thread.messages.push({ role: 'assistant', content });
            saveHistory();
        }
    }
}

window.sendMessage = async () => {
    const input = document.getElementById('user-input');
    const container = document.getElementById('messages-container');
    const sendBtn = document.getElementById('send-button');
    if (!input || !input.value.trim() || sendBtn.dataset.state === 'talking') return;

    const text = input.value.trim();
    input.value = '';
    input.style.height = 'auto';

    // Save to history
    const thread = chatHistory.find(t => t.id === currentThreadId);
    if (thread) {
        if (thread.messages.length === 0) {
            thread.title = text.length > 25 ? text.substring(0, 22) + '...' : text;
            renderHistory();
        }
        thread.messages.push({ role: 'user', content: text });
        saveHistory();
    }

    sendBtn.dataset.state = 'talking';
    sendBtn.innerHTML = '<i class="fas fa-square text-[10px]"></i>';

    addUserMessageToUI(text);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    
    // Show "Thinking..." message
    const thinkingDiv = document.createElement('div');
    thinkingDiv.id = "thinking-bubble";
    thinkingDiv.className = "flex space-x-6 max-w-4xl message-bubble opacity-50";
    thinkingDiv.innerHTML = `
        <div class="w-10 h-10 bg-slate-700 rounded-xl flex-shrink-0 flex items-center justify-center">
            <i class="fas fa-robot text-white"></i>
        </div>
        <div class="flex-1 space-y-4 pt-2">
            <p class="text-[10px] text-muted animate-pulse font-bold uppercase tracking-widest">Thinking...</p>
        </div>
    `;
    container.appendChild(thinkingDiv);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    try {
        const response = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        
        const bubble = document.getElementById('thinking-bubble');
        if (bubble) bubble.remove();

        const reply = data.reply || data.error || 'Sorry, I failed to get a response.';
        addAIMessage(reply);
        
        // Ensure the new message is scrolled into view
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('Fetch error:', error);
        const bubble = document.getElementById('thinking-bubble');
        if (bubble) bubble.remove();
        
        // Reset button BEFORE alert
        sendBtn.dataset.state = 'idle';
        sendBtn.innerHTML = '<i class="fas fa-arrow-up text-sm"></i>';
        
        alert('Could not connect to the AI backend. Please check if your server is running.');
    } finally {
        if (sendBtn.dataset.state === 'talking') {
            sendBtn.dataset.state = 'idle';
            sendBtn.innerHTML = '<i class="fas fa-arrow-up text-sm"></i>';
        }
    }
};

window.clearConversation = () => {
    if (confirm('Are you sure you want to delete this conversation?')) {
        chatHistory = chatHistory.filter(t => t.id !== currentThreadId);
        saveHistory();
        if (chatHistory.length > 0) {
            switchThread(chatHistory[0].id);
        } else {
            newThread();
        }
    }
};

window.exportChat = () => {
    const thread = chatHistory.find(t => t.id === currentThreadId);
    if (!thread || thread.messages.length === 0) {
        alert('No conversation to export!');
        return;
    }

    let markdown = `# Nexus AI Conversation: ${thread.title}\n\n`;
    thread.messages.forEach(msg => {
        const role = msg.role === 'user' ? "User" : "AI";
        markdown += `### ${role}\n${msg.content}\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_chat_${thread.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    });
};

// Mobile Toggles
window.toggleMobileMenu = () => {
    const nav = document.getElementById('nav-links');
    if(nav) {
        nav.classList.toggle('hidden');
        nav.classList.toggle('flex');
    }
};

window.toggleSidebar = () => {
    document.body.classList.toggle('sidebar-active');
};
