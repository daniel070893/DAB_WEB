import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Catalogo } from './catalogo/catalogo'; // Ajusta la importación según el nombre exacto de la clase

const routes: Routes = [
  { path: '', component: Catalogo }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicRoutingModule { }