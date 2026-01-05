import { createSignal, createRoot, createEffect } from 'solid-js';
import { api, setAuthToken, clearAuthToken } from './api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

function createAuthStore() {
  const [state, setState] = createSignal<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  
  const [error, setError] = createSignal<string | null>(null);
  
  async function checkAuth() {
    try {
      const user = await api.auth.getCurrentUser();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }
  
  async function login(email: string, password: string) {
    setError(null);
    setState((s) => ({ ...s, isLoading: true }));
    
    try {
      const { token, user } = await api.auth.login(email, password);
      setAuthToken(token);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setState((s) => ({ ...s, isLoading: false }));
      return false;
    }
  }
  
  async function logout() {
    try {
      await api.auth.logout();
    } catch {
      // Continue with logout even if API call fails
    }
    clearAuthToken();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }
  
  return {
    state,
    error,
    login,
    logout,
    checkAuth,
  };
}

export const authStore = createRoot(createAuthStore);
