import { signUp, signIn, logOut, checkAuthState } from './auth';
import { createTicket, getUserTickets, getAllTickets, updateTicketStatus } from './tickets';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDisplayName = (user) => {
  if (user.displayName) return user.displayName;
  const name = user.email.split('@')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const getAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`;

const populateUserUI = (user) => {
  const displayName = getDisplayName(user);
  const nameEl    = document.getElementById('user-name');
  const emailEl   = document.getElementById('user-email');
  const avatarEl  = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('welcome-name');
  if (nameEl)    nameEl.textContent  = displayName;
  if (emailEl)   emailEl.textContent = user.email;
  if (avatarEl)  avatarEl.src        = user.photoURL || getAvatarUrl(displayName);
  if (welcomeEl) welcomeEl.textContent = displayName;
};

const getStatusClass = (status) => {
  switch (status) {
    case 'Open':        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    case 'In Progress': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
    case 'Resolved':    return 'bg-green-500/10 text-green-500 border border-green-500/20';
    case 'Closed':      return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
    default:            return 'bg-slate-500/10 text-slate-500';
  }
};

// ─── Global state ─────────────────────────────────────────────────────────────
let loadedTickets = [];
let currentUser   = null;
let adminPollInterval = null;

// ─── Route Guard & Page Init ──────────────────────────────────────────────────
checkAuthState(async (user) => {
  const path = window.location.pathname;

  if (path.includes('chat.html') || path.includes('support.html')) {
    if (!user) {
      window.location.href = '/index.html';
      return;
    }
    currentUser = user;
    populateUserUI(user);

    if (path.includes('support.html')) {
      await loadUserTickets();
    }
  }

  if (path.includes('admin.html')) {
    if (!user) {
      window.location.href = '/index.html';
    }
    // Admin tickets are loaded after password verification
  }
});

// ─── Support Page: Load user tickets ─────────────────────────────────────────
async function loadUserTickets() {
  const listEl = document.getElementById('tickets-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="flex items-center justify-center py-12 space-x-3 text-muted">
      <i class="fas fa-circle-notch animate-spin text-accent text-xl"></i>
      <span class="text-sm font-medium">Loading tickets...</span>
    </div>`;

  const tickets = await getUserTickets(currentUser.uid);
  loadedTickets = tickets;
  renderUserTicketsList(tickets);
}

function renderUserTicketsList(tickets) {
  const listEl = document.getElementById('tickets-list');
  if (!listEl) return;

  if (tickets.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-12">
        <i class="fas fa-ticket-alt text-3xl text-muted mb-4"></i>
        <p class="text-muted text-sm">No tickets yet. Submit one above!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = tickets.map(ticket => `
    <div class="p-6 glass-card rounded-2xl border border-slate-800 hover:border-slate-700 transition fade-in">
      <div class="flex justify-between items-start mb-2">
        <h4 class="font-bold text-sm pr-4 truncate">${escHtml(ticket.title)}</h4>
        <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-widest shrink-0 ${getStatusClass(ticket.status)}">
          ${ticket.status}
        </span>
      </div>
      <p class="text-xs text-muted mb-4 line-clamp-2">${escHtml(ticket.description)}</p>
      <div class="flex justify-between items-center">
        <p class="text-[10px] text-muted font-bold">${new Date(ticket.createdAt).toLocaleString()}</p>
        <button onclick="window.viewTicketDetails('${ticket.id}')"
          class="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest">
          View Details
        </button>
      </div>
    </div>
  `).join('');
}

// ─── Submit Ticket ────────────────────────────────────────────────────────────
window.submitTicketAction = async (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('ticket-title');
  const descInput  = document.getElementById('ticket-description');
  const btn        = document.getElementById('submit-btn');

  const title       = titleInput.value.trim();
  const description = descInput.value.trim();
  if (!title || !description) return;

  if (!currentUser) {
    alert('You must be logged in to submit a ticket.');
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Submitting...';
  btn.classList.add('opacity-70', 'cursor-not-allowed');

  const { ticket, error } = await createTicket(
    currentUser.uid,
    currentUser.email,
    title,
    description
  );

  // Reset button
  btn.disabled = false;
  btn.innerHTML = '<span>Submit Ticket</span><i class="fas fa-paper-plane text-xs ml-2"></i>';
  btn.classList.remove('opacity-70', 'cursor-not-allowed');

  if (ticket) {
    titleInput.value = '';
    descInput.value  = '';
    // Optimistically add to top of list
    loadedTickets.unshift(ticket);
    renderUserTicketsList(loadedTickets);
    showToast('Ticket submitted successfully! ✅');
  } else {
    alert('Error submitting ticket: ' + error);
  }
};

// ─── Admin: Password Verification ────────────────────────────────────────────
window.verifyAdmin = async () => {
  const pass = document.getElementById('admin-password').value;
  if (pass !== 'admin123') {
    alert('Incorrect admin password!');
    return;
  }

  document.getElementById('admin-auth-overlay').classList.add('hidden');
  const content = document.getElementById('admin-content');
  content.classList.remove('opacity-0', 'pointer-events-none');

  // Initial load
  await loadAdminTickets();

  // Poll every 5 seconds for new tickets
  clearInterval(adminPollInterval);
  adminPollInterval = setInterval(loadAdminTickets, 5000);
};

// ─── Admin: Load All Tickets ──────────────────────────────────────────────────
async function loadAdminTickets() {
  const listEl   = document.getElementById('admin-tickets-list');
  const countEl  = document.getElementById('total-tickets');
  if (!listEl) return;

  const tickets = await getAllTickets();

  // Merge with existing to avoid status-dropdown flicker on re-render
  // Only re-render if the ticket list changed
  const newHash = tickets.map(t => t.id + t.status + t.updatedAt).join('|');
  if (listEl.dataset.hash === newHash) return; // Nothing changed
  listEl.dataset.hash = newHash;

  loadedTickets = tickets;
  if (countEl) countEl.textContent = tickets.length;

  if (tickets.length === 0) {
    listEl.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-muted">No tickets found.</td></tr>';
    return;
  }

  listEl.innerHTML = tickets.map(ticket => {
    const isNew = (Date.now() - new Date(ticket.createdAt).getTime()) < 300000; // 5 min
    return `
      <tr class="hover:bg-slate-800/30 transition">
        <td class="px-6 py-4">
          <div class="text-sm font-bold text-white">${ticket.userEmail ? ticket.userEmail.split('@')[0] : 'User'}</div>
          <div class="text-[10px] text-muted">${ticket.userEmail || 'N/A'}</div>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center space-x-2">
            <span class="text-sm font-medium text-slate-300 max-w-xs truncate cursor-pointer hover:text-accent"
              onclick="window.viewTicketDetails('${ticket.id}')">${escHtml(ticket.title)}</span>
            ${isNew ? '<span class="px-1.5 py-0.5 bg-green-500 text-white text-[8px] font-bold rounded uppercase shrink-0">NEW</span>' : ''}
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-widest ${getStatusClass(ticket.status)}">
            ${ticket.status}
          </span>
        </td>
        <td class="px-6 py-4 text-[10px] text-muted">
          ${new Date(ticket.createdAt).toLocaleDateString()}
        </td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end space-x-3">
            <select id="status-select-${ticket.id}"
              onchange="window.updateStatus('${ticket.id}', this.value)"
              class="bg-slate-900 border border-slate-800 text-[10px] font-bold rounded-lg px-2 py-1.5 outline-none focus:border-accent cursor-pointer">
              <option value="Open"        ${ticket.status === 'Open'        ? 'selected' : ''}>Open</option>
              <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved"    ${ticket.status === 'Resolved'    ? 'selected' : ''}>Resolved</option>
              <option value="Closed"      ${ticket.status === 'Closed'      ? 'selected' : ''}>Closed</option>
            </select>
            <button onclick="window.viewTicketDetails('${ticket.id}')"
              class="p-2 text-muted hover:text-accent transition">
              <i class="fas fa-eye text-xs"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── Admin: Update Ticket Status ──────────────────────────────────────────────
window.updateStatus = async (id, status) => {
  const { success, error } = await updateTicketStatus(id, status);
  if (success) {
    showToast(`Status updated to "${status}" ✅`);
    // Update local state immediately
    const idx = loadedTickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      loadedTickets[idx].status = status;
    }
    // Refresh the detail modal if it's open for this ticket
    const modal = document.getElementById('ticket-detail-modal');
    if (modal && !modal.classList.contains('hidden')) {
      window.viewTicketDetails(id);
    }
  } else {
    alert('Update failed: ' + error);
  }
};

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────
window.viewTicketDetails = (id) => {
  const ticket = loadedTickets.find(t => t.id === id);
  if (!ticket) return;

  let modal = document.getElementById('ticket-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ticket-detail-modal';
    modal.className = 'fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="max-w-2xl w-full glass-card p-8 rounded-3xl border border-slate-800 relative fade-in">
      <button onclick="document.getElementById('ticket-detail-modal').remove()"
        class="absolute top-6 right-6 text-muted hover:text-white transition">
        <i class="fas fa-times text-xl"></i>
      </button>
      <div class="flex items-center space-x-3 mb-6">
        <span class="text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${getStatusClass(ticket.status)}">
          ${ticket.status}
        </span>
        <span class="text-[10px] text-muted font-mono">ID: ${ticket.id}</span>
      </div>
      <h2 class="text-2xl font-bold mb-6">${escHtml(ticket.title)}</h2>
      <div class="space-y-6">
        <div>
          <h3 class="text-[10px] text-muted font-bold uppercase tracking-widest mb-2">Description</h3>
          <div class="bg-input p-6 rounded-2xl text-slate-300 text-sm leading-relaxed border border-slate-800">
            ${escHtml(ticket.description)}
          </div>
        </div>
        <div class="flex justify-between items-center text-[10px] font-bold text-muted uppercase">
          <div class="flex items-center space-x-2">
            <i class="far fa-user text-accent"></i>
            <span>${ticket.userEmail || 'N/A'}</span>
          </div>
          <div class="flex items-center space-x-2">
            <i class="far fa-clock text-accent"></i>
            <span>Created: ${new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>`;
};

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 right-6 z-[999] bg-slate-900 border border-slate-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl fade-in';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── XSS safety helper ───────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Auth Actions ─────────────────────────────────────────────────────────────
window.signUpAction = async (e) => {
  e.preventDefault();
  const email    = e.target.querySelector('input[type="email"]').value;
  const password = e.target.querySelector('input[type="password"]').value;
  const { user, error } = await signUp(email, password);
  if (user) window.location.href = '/chat.html';
  else alert('Sign up failed: ' + error);
};

window.signInAction = async (e) => {
  e.preventDefault();
  const email    = e.target.querySelector('input[type="email"]').value;
  const password = e.target.querySelector('input[type="password"]').value;
  const { user, error } = await signIn(email, password);
  if (user) window.location.href = '/chat.html';
  else alert('Sign in failed: ' + error);
};

window.signOutAction = logOut;
