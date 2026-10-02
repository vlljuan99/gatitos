import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Outlet, RouterProvider, useRouteError } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import './index.css';
import { PublicLayout } from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ButtonLink, EmptyState, Spinner } from './components/ui.jsx';
import { purgeOldDrafts } from './lib/drafts.js';
import Home from './pages/Home.jsx';
import Cats from './pages/Cats.jsx';
import CatDetail from './pages/CatDetail.jsx';
import Match from './pages/Match.jsx';

function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="py-16">
      <EmptyState title="¡Vaya! Algo se ha enredado" tone="melocoton" action={<ButtonLink to="/" reloadDocument>Volver al inicio</ButtonLink>}>
        Recarga la página o vuelve a intentarlo en un momento.
      </EmptyState>
    </div>
  );
}

// Las páginas menos visitadas se descargan al entrar en ellas.
const page = (load, props) => () => load().then(({ default: Page }) => ({ Component: () => <Page {...props} /> }));

const loading = <Spinner />;

// Los avisos (toasts) van dentro del router porque pueden llevar enlaces.
function Root() {
  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    hydrateFallbackElement: loading,
    children: [
      {
        // El panel se descarga aparte: quien visita la web no carga su código.
        path: '/admin/*',
        lazy: () => import('./admin/AdminApp.jsx').then((m) => ({ Component: m.default })),
        hydrateFallbackElement: loading,
        errorElement: <RouteError />,
      },
      {
        element: <PublicLayout />,
        hydrateFallbackElement: loading,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Home /> },
          { path: 'gatitos', element: <Cats /> },
          { path: 'gatitos/:slug', element: <CatDetail /> },
          { path: 'match', element: <Match /> },
          { path: 'favoritos', lazy: page(() => import('./pages/Favorites.jsx')) },
          { path: 'como-trabajamos', lazy: page(() => import('./pages/HowWeWork.jsx')) },
          { path: 'adoptar', lazy: page(() => import('./pages/Adopt.jsx')) },
          { path: 'finales-felices', lazy: page(() => import('./pages/HappyEndings.jsx')) },
          { path: 'colabora', lazy: page(() => import('./pages/Collaborate.jsx')) },
          { path: 'transporte-solidario', lazy: page(() => import('./pages/Transport.jsx')) },
          { path: 'contacto', lazy: page(() => import('./pages/Contact.jsx')) },
          { path: 'aviso-legal', lazy: page(() => import('./pages/Legal.jsx'), { page: 'aviso' }) },
          { path: 'privacidad', lazy: page(() => import('./pages/Legal.jsx'), { page: 'privacidad' }) },
          { path: 'cookies', lazy: page(() => import('./pages/Legal.jsx'), { page: 'cookies' }) },
          { path: '*', lazy: page(() => import('./pages/NotFound.jsx')) },
        ],
      },
    ],
  },
]);

purgeOldDrafts();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
);
