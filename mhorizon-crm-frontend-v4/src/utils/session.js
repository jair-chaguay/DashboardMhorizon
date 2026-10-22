// Manejo centralizado de la sesión guardada en localStorage
const TOKEN_KEY = 'token';
const USER_KEY = 'admin_user';
const SAVED_USERNAME_KEY = 'admin_saved_username';

export const AUTH_EXPIRED_EVENT = 'mhorizon:auth-expired';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const getSavedUsername = () => localStorage.getItem(SAVED_USERNAME_KEY) || '';

export function setSavedUsername(username) {
  if (username) localStorage.setItem(SAVED_USERNAME_KEY, username);
  else localStorage.removeItem(SAVED_USERNAME_KEY);
}

// Avisa a App.jsx que el token ya no es válido para volver al Login
export const notifyAuthExpired = () => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
