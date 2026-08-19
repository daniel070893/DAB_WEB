import { Component, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, query } from '@angular/fire/firestore';

import { AuthService } from '../../core/services/auth';
import { PedidoService } from '../../core/services/pedido.service';
import { ItemCarrito } from '../../core/services/cart.service';
import { Producto } from '../../public/catalogo/catalogo';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pos.html',
  styleUrls: ['./pos.scss']
})
export class Pos {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private pedidoService = inject(PedidoService);

  productos = signal<Producto[]>([]);
  cargando = signal(true);

  busqueda = signal('');
  productosFiltrados = computed(() => {
    const termino = this.busqueda().toLowerCase().trim();
    if (!termino) return this.productos();
    return this.productos().filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      (p.detalle || '').toLowerCase().includes(termino)
    );
  });

  private ticketSignal = signal<ItemCarrito[]>([]);
  ticket = this.ticketSignal.asReadonly();
  totalTicket = computed(() => this.ticket().reduce((acc, item) => acc + item.producto.costo * item.cantidad, 0));
  cantidadTicket = computed(() => this.ticket().reduce((acc, item) => acc + item.cantidad, 0));

  mostrarCobro = signal(false);
  efectivoRecibido = signal(0);
  procesandoCobro = signal(false);
  errorCobro = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  cambio = computed(() => Math.max(0, this.efectivoRecibido() - this.totalTicket()));
  puedeConfirmar = computed(() => this.totalTicket() > 0 && this.efectivoRecibido() >= this.totalTicket());

  async ngOnInit() {
    await this.cargarProductos();
  }

  async cargarProductos() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargando.set(true);
    try {
      const refColeccion = collection(this.firestore, 'productos');
      const querySnapshot = await getDocs(query(refColeccion));
      this.productos.set(querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Producto)));
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  buscar(termino: string) {
    this.busqueda.set(termino);
  }

  subtotal(item: ItemCarrito): number {
    return item.producto.costo * item.cantidad;
  }

  agregar(producto: Producto) {
    const items = this.ticketSignal();
    const index = items.findIndex(i => i.producto.id === producto.id);

    if (index > -1) {
      const itemExistente = items[index];
      if (itemExistente.cantidad < producto.existencia) {
        items[index].cantidad++;
        this.ticketSignal.set([...items]);
      }
    } else if (producto.existencia > 0) {
      this.ticketSignal.set([...items, { producto, cantidad: 1 }]);
    }
  }

  aumentar(item: ItemCarrito) {
    this.agregar(item.producto);
  }

  disminuir(item: ItemCarrito) {
    const items = this.ticketSignal();
    const index = items.findIndex(i => i.producto.id === item.producto.id);
    if (index === -1) return;

    const cantidad = items[index].cantidad - 1;
    if (cantidad <= 0) {
      this.ticketSignal.set(items.filter(i => i.producto.id !== item.producto.id));
    } else {
      items[index].cantidad = cantidad;
      this.ticketSignal.set([...items]);
    }
  }

  quitar(item: ItemCarrito) {
    this.ticketSignal.set(this.ticket().filter(i => i.producto.id !== item.producto.id));
  }

  quitarTicket() {
    this.ticketSignal.set([]);
  }

  abrirCobro() {
    if (this.totalTicket() <= 0) return;
    this.efectivoRecibido.set(this.totalTicket());
    this.errorCobro.set(null);
    this.mostrarCobro.set(true);
  }

  cerrarCobro() {
    if (this.procesandoCobro()) return;
    this.mostrarCobro.set(false);
  }

  actualizarEfectivo(event: Event) {
    const valor = Number((event.target as HTMLInputElement).value);
    this.efectivoRecibido.set(Number.isFinite(valor) && valor >= 0 ? valor : 0);
  }

  pagarExacto() {
    this.efectivoRecibido.set(this.totalTicket());
  }

  async confirmarCobro() {
    if (this.procesandoCobro() || !this.puedeConfirmar()) return;
    this.procesandoCobro.set(true);
    this.errorCobro.set(null);
    try {
      const usuario = await this.authService.getUsuarioActual();
      if (!usuario) throw new Error('Sesión no disponible');

      const pedido = await this.pedidoService.registrarVentaMostrador(usuario, this.ticket());

      this.mostrarCobro.set(false);
      this.efectivoRecibido.set(0);
      this.ticketSignal.set([]);
      await this.cargarProductos();

      this.mensajeExito.set(`Venta registrada correctamente — Folio ${pedido.folio}`);
      setTimeout(() => this.mensajeExito.set(null), 6000);
    } catch (error) {
      console.error('Error al registrar la venta', error);
      this.errorCobro.set('No se pudo registrar la venta. Revisa el inventario e intenta de nuevo.');
    } finally {
      this.procesandoCobro.set(false);
    }
  }

  cerrarExito() {
    this.mensajeExito.set(null);
  }
}
