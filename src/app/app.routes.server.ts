import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // El panel admin depende de la sesión y rol del usuario; se renderiza en el navegador
    path: 'admin/**',
    renderMode: RenderMode.Client
  },
  {
    // Detalle de producto es dinámico (id variable); se renderiza en el navegador
    path: 'producto/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
