import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { Pedido, PedidoService } from '../../core/services/pedido.service';

@Component({
  selector: 'app-pedido-exitoso',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pedido-exitoso.html',
  styleUrls: ['./pedido-exitoso.scss']
})
export class PedidoExitoso {
  private router = inject(Router);
  private pedidoService = inject(PedidoService);

  pedido: Pedido | null = null;

  constructor() {
    const nav = this.router.getCurrentNavigation();
    this.pedido = nav?.extras?.state?.['pedido'] ?? this.pedidoService.ultimoPedido();
  }

  totalItem(item: { precioUnitario: number; cantidad: number }): number {
    return item.precioUnitario * item.cantidad;
  }
}
