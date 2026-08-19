import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminLayout } from './layout/admin-layout';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
      { path: 'pedidos', loadComponent: () => import('./pedidos/pedidos').then(m => m.Pedidos) },
      { path: 'pos', loadComponent: () => import('./pos/pos').then(m => m.Pos) },
      { path: 'inventario', loadComponent: () => import('./inventario/inventario').then(m => m.Inventario) },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
