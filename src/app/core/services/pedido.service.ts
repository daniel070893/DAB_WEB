import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, doc, getDoc, writeBatch, Timestamp } from '@angular/fire/firestore';

import { CartService, ItemCarrito } from './cart.service';
import { PerfilUsuario } from './auth';
import { Producto } from '../models/producto';
import { DatosFacturacion } from '../models/factura';

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
  datosFacturacion?: DatosFacturacion;
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

  async procesarPedido(
    usuario: PerfilUsuario,
    datosFacturacion?: DatosFacturacion
  ): Promise<Pedido> {
    return this.registrarPedido(usuario, this.cartService.items(), 'web', 'simulado', datosFacturacion);
  }

  // Venta de mostrador (POS): sin carrito global, se reciben los artículos directamente
  async registrarVentaMostrador(
    usuario: PerfilUsuario,
    items: ItemCarrito[],
    datosFacturacion?: DatosFacturacion
  ): Promise<Pedido> {
    return this.registrarPedido(usuario, items, 'pos', 'efectivo', datosFacturacion);
  }

  private async registrarPedido(
    usuario: PerfilUsuario,
    items: ItemCarrito[],
    origen: 'web' | 'pos',
    metodoPago: 'simulado' | 'efectivo',
    datosFacturacion?: DatosFacturacion
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
      if (!productoId) {
        throw new Error(`El producto "${item.producto.nombre}" no tiene identificador`);
      }

      const prodRef = doc(this.firestore, `productos/${productoId}`);

      try {
        const prodSnap = await getDoc(prodRef);

        if (!prodSnap.exists()) {
          throw new Error(`El producto "${item.producto.nombre}" ya no existe en la base de datos`);
        }

        const data = prodSnap.data();
        const existenciaActual = data?.['existencia'];

        if (existenciaActual === undefined || existenciaActual === null) {
          throw new Error(`El producto "${item.producto.nombre}" no tiene campo de existencia`);
        }

        if (Number(existenciaActual) < item.cantidad) {
          throw new Error(`Existencias insuficientes para "${item.producto.nombre}" (disponibles: ${existenciaActual}, solicitados: ${item.cantidad})`);
        }

        batch.update(prodRef, { existencia: Number(existenciaActual) - item.cantidad });
      } catch (error: any) {
        if (error?.message?.includes('Existencias insuficientes') || error?.message?.includes('ya no existe') || error?.message?.includes('no tiene')) {
          throw error;
        }
        throw new Error(`Error al acceder al producto "${item.producto.nombre}": ${error?.message || error}`);
      }
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
      ...(metodoPago === 'simulado'
        ? { pagadorId: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
        : {}),
      fecha: Timestamp.now(),
      ...(datosFacturacion ? { datosFacturacion } : {}),
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
