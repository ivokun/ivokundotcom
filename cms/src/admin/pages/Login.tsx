import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '../store';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    
    const success = await authStore.login(email(), password());
    if (success) {
      navigate('/', { replace: true });
    } else {
      setError(authStore.error() || 'Login failed');
    }
  }
  
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">CMS Admin</h1>
          <p class="mt-2 text-sm text-gray-600">Sign in to manage your content</p>
        </div>
        
        <div class="card p-8">
          <form onSubmit={handleSubmit} class="space-y-6">
            <Show when={error()}>
              <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error()}
              </div>
            </Show>
            
            <div>
              <label for="email" class="label">Email address</label>
              <input
                id="email"
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                class="input"
                placeholder="admin@example.com"
              />
            </div>
            
            <div>
              <label for="password" class="label">Password</label>
              <input
                id="password"
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                class="input"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={authStore.state().isLoading}
              class="btn btn-primary w-full py-2.5"
            >
              <Show when={!authStore.state().isLoading} fallback={
                <span class="flex items-center justify-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing in...
                </span>
              }>
                Sign in
              </Show>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
