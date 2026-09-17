import { Component, inject, PLATFORM_ID, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Firestore, collection, getDocs, query } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth';
import { BusquedaService } from '../../core/services/busqueda.service';
import { Producto, productoCoincide, productoEnOfertaVigente } from '../../core/models/producto';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './catalogo.html',
  styleUrls: ['./catalogo.scss']
})
export class Catalogo implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);

  public cartService = inject(CartService);
  private authService = inject(AuthService);
  public busquedaService = inject(BusquedaService);

  productos = signal<Producto[]>([]);
  cargando = signal<boolean>(true);
  errorCargar = signal<boolean>(false);

  visibles = computed(() =>
    this.productos().filter(p => productoCoincide(p, this.busquedaService.termino()))
  );

  enOfertaVigente(producto: Producto): boolean {
    return productoEnOfertaVigente(producto);
  }

  readonly placeholderImg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect fill="#f0f0f0" width="300" height="200"/><text fill="#999" font-family="sans-serif" font-size="16" dy="6" font-weight="bold" x="50%" y="50%" text-anchor="middle">Sin Imagen</text></svg>`
  );

  private suscripcionSesion: Subscription | null = null;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.cargarProductos();

      // Cuando la sesión se restaure o cambie, si no se habían cargado los productos, recargar
      this.suscripcionSesion = this.authService.usuario$.subscribe(() => {
        if (this.productos().length === 0 && !this.cargando()) {
          this.cargarProductos();
        }
      });
    }
  }

  ngOnDestroy() {
    this.suscripcionSesion?.unsubscribe();
  }

  async cargarProductos() {
    this.cargando.set(true);
    this.errorCargar.set(false);
    try {
      const docsSnapshot = await runInInjectionContext(this.injector, async () => {
        const refColeccion = collection(this.firestore, 'productos');
        const q = query(refColeccion);
        return await getDocs(q);
      });

      this.ngZone.run(() => {
        const items = docsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Producto));

        this.productos.set(items);
        this.cargando.set(false);
        this.errorCargar.set(false);
        this.cdr.markForCheck();
      });
    } catch (error) {
      console.error('Error al cargar productos:', error);
      this.ngZone.run(() => {
        this.errorCargar.set(true);
        this.cargando.set(false);
        this.cdr.markForCheck();
      });
    }
  }

  agregarAlCarrito(producto: Producto) {
    this.cartService.agregarProducto(producto);
  }

  limpiarBusqueda() {
    this.busquedaService.termino.set('');
  }
}
