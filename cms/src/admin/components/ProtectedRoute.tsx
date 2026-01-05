import { type ParentComponent, createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '../store';

interface ProtectedRouteProps {
  children?: import('solid-js').JSX.Element;
}

const ProtectedRoute: ParentComponent<ProtectedRouteProps> = (props) => {
  const navigate = useNavigate();
  
  createEffect(() => {
    const state = authStore.state();
    
    if (!state.isLoading && !state.isAuthenticated) {
      navigate('/login', { replace: true });
    }
  });
  
  return (
    <Show when={!authStore.state().isLoading}>
      <Show when={authStore.state().isAuthenticated} fallback={
        <div class="flex items-center justify-center min-h-screen">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }>
        {props.children}
      </Show>
    </Show>
  );
};

export default ProtectedRoute;
