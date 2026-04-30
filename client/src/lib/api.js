/**
 * API client with offline retry queue.
 * Requirements: 7.3, 7.4, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5
 */

const API_BASE = '/api';
const RETRY_QUEUE_KEY = 'fastcheck_retry_queue';

/**
 * Creates a new scan session.
 * @param {string} language - Language code
 * @returns {Promise<{ id: string, createdAt: string } | null>}
 */
export async function createSession(language) {
  try {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Updates a session with score fields.
 * @param {string} id - Session UUID
 * @param {Object} payload - Score fields to update
 */
export async function updateSession(id, payload) {
  try {
    const response = await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    // Queue for retry
    const queue = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || '[]');
    queue.push({ id, payload, timestamp: Date.now() });
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Bulk-inserts frame logs for a session.
 * @param {string} sessionId - Session UUID
 * @param {Array} frames - Array of frame objects
 */
export async function bulkInsertFrames(sessionId, frames) {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/frames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    // Fail silently
  }
}

/**
 * Gets nearest hospitals from API.
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Hospital array
 * @throws {Error} When API fails (caller handles fallback)
 */
export async function getNearestHospitals(lat, lng) {
  const response = await fetch(`${API_BASE}/hospitals/nearest?lat=${lat}&lng=${lng}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Submits feedback for a session.
 * @param {string} sessionId - Session UUID
 * @param {boolean} wasStroke - Whether the patient had a stroke
 * @param {string} [notes] - Optional notes
 */
export async function submitFeedback(sessionId, wasStroke, notes) {
  try {
    const response = await fetch(`${API_BASE}/feedback/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wasStroke, notes }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    // Fail silently
  }
}

/**
 * Retries queued session updates from localStorage.
 */
export async function retryQueue() {
  const queue = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || '[]');
  if (queue.length === 0) {
    return;
  }

  const remaining = [];

  for (const item of queue) {
    try {
      const response = await fetch(`${API_BASE}/sessions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (!response.ok) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(remaining));
}