import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Firestore, collection, query, orderBy, limit } from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { Pedido } from '../../core/services/pedido.service';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pedidos.html',
  styleUrls: ['./pedidos.scss']
})
export class Pedidos {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);

  filtro = signal<'todos' | 'web' | 'pos'>('todos');
  detalleAbierto = signal<string | null>(null);

  pedidos$: Observable<Pedido[]> | null = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        this.pedidos$ = collectionData(
          query(collection(this.firestore, 'pedidos'), orderBy('fecha', 'desc'), limit(100)),
          { idField: 'id' }
        ) as Observable<Pedido[]>;
      } catch (error) {
        console.error('Error al configurar la lista de pedidos:', error);
      }
    }
  }

  filtrar(pedidos: Pedido[] | null): Pedido[] {
    if (!pedidos) return [];
    if (this.filtro() === 'todos') return pedidos;
    return pedidos.filter(p => p.origen === this.filtro());
  }

  cambiarFiltro(filtro: 'todos' | 'web' | 'pos') {
    this.filtro.set(filtro);
  }

  alternarDetalle(folio: string) {
    this.detalleAbierto.set(this.detalleAbierto() === folio ? null : folio);
  }

  cantidadItems(pedido: Pedido): number {
    return pedido.items.reduce((acc, item) => acc + item.cantidad, 0);
  }

  fecha(pedido: Pedido): Date {
    return pedido.fecha ? pedido.fecha.toDate() : new Date();
  }

  origenLabel(pedido: Pedido): string {
    return pedido.origen === 'pos' ? 'Mostrador' : 'Web';
  }

  pagoLabel(pedido: Pedido): string {
    return pedido.metodoPago === 'efectivo' ? 'Efectivo' : 'Mercado Pago (demo)';
  }
}
