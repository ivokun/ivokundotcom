import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

import { Layout } from '~/admin/components/layout'
import { CategoriesPage } from '~/admin/pages/categories'
import { DashboardPage } from '~/admin/pages/dashboard'
import { GalleriesListPage } from '~/admin/pages/galleries-list'
import { GalleryFormPage } from '~/admin/pages/gallery-form'
import { HomePageEditor } from '~/admin/pages/home'
import { LoginPage } from '~/admin/pages/login'
import { MediaLibraryPage } from '~/admin/pages/media'
import { PostFormPage } from '~/admin/pages/post-form'
import { PostsListPage } from '~/admin/pages/posts-list'
import { SettingsPage } from '~/admin/pages/settings'
import { UsersPage } from '~/admin/pages/users'

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})

// Layout routes
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  component: Outlet,
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
})

// Auth routes
const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/admin/login',
  component: LoginPage,
})

// App routes
const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin',
  component: DashboardPage,
})

const postsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/posts',
  component: PostsListPage,
})

const postNewRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/posts/new',
  component: PostFormPage,
})

const postEditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/posts/$id/edit',
  component: PostFormPage,
})

const mediaRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/media',
  component: MediaLibraryPage,
})

const categoriesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/categories',
  component: CategoriesPage,
})

const galleriesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/galleries',
  component: GalleriesListPage,
})

const galleryNewRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/galleries/new',
  component: GalleryFormPage,
})

const galleryEditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/galleries/$id/edit',
  component: GalleryFormPage,
})

const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/home',
  component: HomePageEditor,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/settings',
  component: SettingsPage,
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin/users',
  component: UsersPage,
})

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute]),
  appLayoutRoute.addChildren([
    indexRoute,
    postsRoute,
    postNewRoute,
    postEditRoute,
    mediaRoute,
    categoriesRoute,
    galleriesRoute,
    galleryNewRoute,
    galleryEditRoute,
    homeRoute,
    settingsRoute,
    usersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
