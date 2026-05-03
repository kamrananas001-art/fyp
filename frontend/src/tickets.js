const API = 'http://localhost:5000/api/tickets';

/**
 * Create a new ticket via the backend API.
 */
export const createTicket = async (userId, userEmail, title, description) => {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userEmail, title, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create ticket');
    return { ticket: data, error: null };
  } catch (err) {
    return { ticket: null, error: err.message };
  }
};

/**
 * Fetch all tickets for one user (for the support page).
 */
export const getUserTickets = async (userId) => {
  try {
    const res = await fetch(`${API}/user/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch tickets');
    return await res.json();
  } catch (err) {
    console.error('getUserTickets error:', err);
    return [];
  }
};

/**
 * Fetch ALL tickets (for admin dashboard).
 */
export const getAllTickets = async () => {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('Failed to fetch all tickets');
    return await res.json();
  } catch (err) {
    console.error('getAllTickets error:', err);
    return [];
  }
};

/**
 * Update a ticket's status (admin action).
 */
export const updateTicketStatus = async (ticketId, newStatus) => {
  try {
    const res = await fetch(`${API}/${ticketId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    return { success: true, ticket: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
