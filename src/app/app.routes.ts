import { Routes } from '@angular/router';

import { adminGuard } from './admin/admin.guard';

export const routes: Routes = [
  { 
    path: '', 
    // Usamos loadComponent en lugar de loadChildren porque Catalogo es standalone
    loadComponent: () => import('./public/catalogo/catalogo').then(c => c.Catalogo) 
  },
  { 
    path: 'carrito', 
    loadComponent: () => import('./public/carrito/carrito').then(c => c.Carrito) 
  },
  { 
    path: 'producto/:id', 
    loadComponent: () => import('./public/producto-detalle/producto-detalle').then(c => c.ProductoDetalle) 
  },
  { 
    path: 'pedido-exitoso', 
    loadComponent: () => import('./public/pedido-exitoso/pedido-exitoso').then(c => c.PedidoExitoso) 
  },
  { 
    path: 'admin', 
    canActivate: [adminGuard],
    loadChildren: () => import('./admin/admin-module').then(m => m.AdminModule) 
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];