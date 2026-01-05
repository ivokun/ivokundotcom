import { onMount, lazy } from 'solid-js';
import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import { authStore } from './store';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Categories = lazy(() => import('./pages/Categories'));
const CategoryForm = lazy(() => import('./pages/CategoryForm'));
const Media = lazy(() => import('./pages/Media'));
const Posts = lazy(() => import('./pages/Posts'));
const PostForm = lazy(() => import('./pages/PostForm'));
const Galleries = lazy(() => import('./pages/Galleries'));
const GalleryForm = lazy(() => import('./pages/GalleryForm'));
const Home = lazy(() => import('./pages/Home'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  // Initialize auth check on mount
  onMount(() => {
    authStore.checkAuth();
  });
  
  return (
    <Router root={Layout}>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={ProtectedRoute}
      >
        <Route path="" component={Dashboard} />
      </Route>
      <Route
        path="/categories"
        component={ProtectedRoute}
      >
        <Route path="" component={Categories} />
        <Route path="new" component={CategoryForm} />
        <Route path=":id" component={CategoryForm} />
      </Route>
      <Route
        path="/media"
        component={ProtectedRoute}
      >
        <Route path="" component={Media} />
      </Route>
      <Route
        path="/posts"
        component={ProtectedRoute}
      >
        <Route path="" component={Posts} />
        <Route path="new" component={PostForm} />
        <Route path=":id" component={PostForm} />
      </Route>
      <Route
        path="/galleries"
        component={ProtectedRoute}
      >
        <Route path="" component={Galleries} />
        <Route path="new" component={GalleryForm} />
        <Route path=":id" component={GalleryForm} />
      </Route>
      <Route
        path="/home"
        component={ProtectedRoute}
      >
        <Route path="" component={Home} />
      </Route>
      <Route
        path="/settings"
        component={ProtectedRoute}
      >
        <Route path="" component={Settings} />
      </Route>
    </Router>
  );
}

const root = document.getElementById('admin-app');
if (root) {
  render(() => <App />, root);
}

if (import.meta.env['DEV']) {
  console.log('CMS Admin SPA loaded');
}
