import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, doc, getDoc, writeBatch, Timestamp } from '@angular/fire/firestore';

import { CartService, ItemCarrito } from './cart.service';
import { PerfilUsuario } from './auth';
import { Producto } from '../models/producto';

export interface ItemPedido {
  productoId: string;
  nombre: string;
  detalle: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Pedido {
  id?: string;
  folio: string;
  usuarioUid: string;
  usuarioNombre: string;
  usuarioEmail: string;
  items: ItemPedido[];
  total: number;
  estado: 'Pagado';
  origen: 'web' | 'pos';
  metodoPago: 'simulado' | 'efectivo';
  pagadorId?: string;
  fecha: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  private firestore = inject(Firestore);
  private cartService = inject(CartService);

  // Último pedido procesado, para mostrarlo en la pantalla de éxito
  private ultimoPedidoSignal = signal<Pedido | null>(null);
  ultimoPedido = this.ultimoPedidoSignal.asReadonly();

  async procesarPedido(usuario: PerfilUsuario): Promise<Pedido> {
    return this.registrarPedido(usuario, this.cartService.items(), 'web', 'simulado');
  }

  // Venta de mostrador (POS): sin carrito global, se reciben los artículos directamente
  async registrarVentaMostrador(usuario: PerfilUsuario, items: ItemCarrito[]): Promise<Pedido> {
    return this.registrarPedido(usuario, items, 'pos', 'efectivo');
  }

  private async registrarPedido(
    usuario: PerfilUsuario,
    items: ItemCarrito[],
    origen: 'web' | 'pos',
    metodoPago: 'simulado' | 'efectivo'
  ): Promise<Pedido> {
    if (items.length === 0) {
      throw new Error('El carrito está vacío');
    }
    if (!usuario.uid) {
      throw new Error('Sesión no disponible');
    }

    const batch = writeBatch(this.firestore);
    const pedidoRef = doc(collection(this.firestore, 'pedidos'));

    const itemsPedido: ItemPedido[] = items.map(item => {
      if (!item.producto.id) {
        throw new Error(`El producto "${item.producto.nombre}" no tiene identificador`);
      }
      return {
        productoId: item.producto.id,
        nombre: item.producto.nombre,
        detalle: item.producto.detalle,
        cantidad: item.cantidad,
        precioUnitario: item.producto.costo,
        subtotal: item.producto.costo * item.cantidad,
      };
    });

    // Descontar inventario validando existencias actuales en Firestore
    for (const item of items) {
      const productoId = item.producto.id;
      if (!productoId) continue;

      const prodRef = doc(this.firestore, `productos/${productoId}`);
      const prodSnap = await getDoc(prodRef);

      if (!prodSnap.exists()) {
        throw new Error(`El producto "${item.producto.nombre}" ya no existe`);
      }

      const producto = prodSnap.data() as Producto;
      const existenciaActual = producto.existencia ?? 0;
      if (existenciaActual < item.cantidad) {
        throw new Error(`Existencias insuficientes para "${item.producto.nombre}" (disponibles: ${existenciaActual})`);
      }

      batch.update(prodRef, { existencia: existenciaActual - item.cantidad });
    }

    const pedido: Pedido = {
      folio: this.crearFolio(),
      usuarioUid: usuario.uid,
      usuarioNombre: usuario.nombre,
      usuarioEmail: usuario.email,
      items: itemsPedido,
      total: itemsPedido.reduce((acc, item) => acc + item.subtotal, 0),
      estado: 'Pagado',
      origen,
      metodoPago,
      pagadorId: metodoPago === 'simulado'
        ? `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
        : undefined,
      fecha: Timestamp.now(),
    };

    batch.set(pedidoRef, pedido);
    await batch.commit();

    const pedidoCompleto: Pedido = { ...pedido, id: pedidoRef.id };
    this.ultimoPedidoSignal.set(pedidoCompleto);
    return pedidoCompleto;
  }

  private crearFolio(): string {
    const ahora = new Date();
    const fecha = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}`;
    const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${fecha}-${aleatorio}`;
  }
}
