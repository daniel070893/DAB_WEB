import { Injectable, signal, computed } from '@angular/core';
import { Producto } from '../../public/catalogo/catalogo';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  // Signal privado con los elementos del carrito
  private itemsSignal = signal<ItemCarrito[]>([]);

  // Signals públicos de solo lectura para la interfaz
  items = this.itemsSignal.asReadonly();
  
  // Calcula el total de piezas en el carrito automáticamente
  cantidadTotal = computed(() => 
    this.itemsSignal().reduce((acc, item) => acc + item.cantidad, 0)
  );

  // Calcula el precio total a pagar
  precioTotal = computed(() => 
    this.itemsSignal().reduce((acc, item) => acc + (item.producto.costo * item.cantidad), 0)
  );

  // Agregar producto al carrito
  agregarProducto(producto: Producto) {
    this.agregarCantidad(producto, 1);
  }

  // Agregar una cantidad específica de un producto (respetando la existencia)
  agregarCantidad(producto: Producto, cantidad: number) {
    const itemsActuales = this.itemsSignal();
    const index = itemsActuales.findIndex(i => i.producto.id === producto.id);
    const cantidadFinal = Math.min(Math.max(0, cantidad), producto.existencia);

    if (cantidadFinal <= 0) return;

    if (index > -1) {
      const itemExistente = itemsActuales[index];
      itemExistente.cantidad = Math.min(itemExistente.cantidad + cantidadFinal, producto.existencia);
      this.itemsSignal.set([...itemsActuales]);
    } else {
      this.itemsSignal.set([...itemsActuales, { producto, cantidad: cantidadFinal }]);
    }
  }

  // Disminuir cantidad en 1; si llega a 0 se elimina del carrito
  disminuirProducto(productoId: string) {
    const itemsActuales = this.itemsSignal();
    const index = itemsActuales.findIndex(i => i.producto.id === productoId);

    if (index === -1) return;

    const cantidad = itemsActuales[index].cantidad - 1;
    if (cantidad <= 0) {
      this.itemsSignal.set(itemsActuales.filter(i => i.producto.id !== productoId));
    } else {
      itemsActuales[index].cantidad = cantidad;
      this.itemsSignal.set([...itemsActuales]);
    }
  }

  // Quitar o eliminar producto por completo
  removerProducto(productoId: string) {
    const itemsActuales = this.itemsSignal();
    this.itemsSignal.set(itemsActuales.filter(i => i.producto.id !== productoId));
  }

  // Vaciar carrito completo
  limpiarCarrito() {
    this.itemsSignal.set([]);
  }
}