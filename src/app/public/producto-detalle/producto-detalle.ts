import { Component, inject, PLATFORM_ID, signal, OnInit, ChangeDetectorRef, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

import { CartService } from '../../core/services/cart.service';
import { Producto } from '../catalogo/catalogo';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './producto-detalle.html',
  styleUrls: ['./producto-detalle.scss']
})
export class ProductoDetalle implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private cartService = inject(CartService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);

  producto = signal<Producto | null>(null);
  cargando = signal<boolean>(true);
  noEncontrado = signal<boolean>(false);

  imagenSeleccionada = signal('');
  cantidad = signal(1);
  agregado = signal(false);

  readonly placeholderImg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#f0f0f0" width="600" height="400"/><text fill="#999" font-family="sans-serif" font-size="20" dy="8" font-weight="bold" x="50%" y="50%" text-anchor="middle">Sin Imagen</text></svg>`
  );

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id || !isPlatformBrowser(this.platformId)) {
      this.noEncontrado.set(true);
      this.cargando.set(false);
      return;
    }

    try {
      const snap = await runInInjectionContext(this.injector, async () => {
        const docRef = doc(this.firestore, `productos/${id}`);
        return await getDoc(docRef);
      });

      this.ngZone.run(() => {
        if (snap.exists()) {
          const prod = { id: snap.id, ...snap.data() } as Producto;
          this.producto.set(prod);
          this.imagenSeleccionada.set(prod.urlsGaleria?.[0] ?? '');
          this.noEncontrado.set(false);
        } else {
          this.noEncontrado.set(true);
        }
        this.cargando.set(false);
        this.cdr.markForCheck();
      });
    } catch (error) {
      console.error('Error al cargar el producto:', error);
      this.ngZone.run(() => {
        this.noEncontrado.set(true);
        this.cargando.set(false);
        this.cdr.markForCheck();
      });
    }
  }

  urls(): string[] {
    return this.producto()?.urlsGaleria ?? [];
  }

  seleccionarImagen(url: string) {
    this.imagenSeleccionada.set(url);
  }

  imagenActual(): string {
    return this.imagenSeleccionada() || (this.producto()?.urlsGaleria?.[0] ?? '');
  }

  aumentar() {
    const prod = this.producto();
    if (prod && this.cantidad() < prod.existencia) {
      this.cantidad.set(this.cantidad() + 1);
    }
  }

  disminuir() {
    if (this.cantidad() > 1) {
      this.cantidad.set(this.cantidad() - 1);
    }
  }

  agregarAlCarrito() {
    const prod = this.producto();
    if (!prod || prod.existencia <= 0) return;
    this.cartService.agregarCantidad(prod, this.cantidad());
    this.agregado.set(true);
    setTimeout(() => this.agregado.set(false), 2500);
  }
}
