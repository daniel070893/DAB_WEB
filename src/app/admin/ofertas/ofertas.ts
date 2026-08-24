import { Component, inject, PLATFORM_ID, OnInit, signal, computed, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, query, doc, updateDoc, deleteField } from '@angular/fire/firestore';

import { Producto } from '../../core/models/producto';

@Component({
  selector: 'app-ofertas-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ofertas.html',
  styleUrls: ['./ofertas.scss']
})
export class OfertasAdmin implements OnInit {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);

  productos = signal<Producto[]>([]);
  cargando = signal(true);
  errorCargar = signal(false);

  guardandoId = signal<string | null>(null);
  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  private timerMensaje: ReturnType<typeof setTimeout> | null = null;

  productosConOferta = computed(() => this.productos().filter(p => !!p.enOferta).length);

  readonly placeholderMini = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="#eeeeee" width="48" height="48"/><text fill="#bbb" font-family="sans-serif" font-size="10" dy="3.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Sin Imagen</text></svg>`
  );

  async ngOnInit() {
    await this.cargarProductos();
  }

  async cargarProductos() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargando.set(true);
    this.errorCargar.set(false);
    try {
      const docsSnapshot = await runInInjectionContext(this.injector, async () => {
        const refColeccion = collection(this.firestore, 'productos');
        return await getDocs(query(refColeccion));
      });

      this.ngZone.run(() => {
        const items = docsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Producto))
          .filter(p => (p.existencia ?? 0) > 0)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        this.productos.set(items);
        this.cargando.set(false);
      });
    } catch (error) {
      console.error('Error al cargar productos:', error);
      this.ngZone.run(() => {
        this.errorCargar.set(true);
        this.cargando.set(false);
      });
    }
  }

  toggleOferta(p: Producto, evento: Event) {
    const activar = (evento.target as HTMLInputElement).checked;
    p.enOferta = activar;
    if (activar) {
      if (!p.precioRegular || p.precioRegular <= 0) {
        p.precioRegular = p.costo;
      }
      if (!p.ofertaVigencia) {
        const fin = new Date();
        fin.setDate(fin.getDate() + 30);
        p.ofertaVigencia = fin.toISOString().slice(0, 10);
      }
    } else {
      p.precioRegular = undefined;
      p.precioOferta = undefined;
      p.ofertaVigencia = null;
    }
  }

  setNumero(p: Producto, campo: 'precioRegular' | 'precioOferta', evento: Event) {
    const valor = Number((evento.target as HTMLInputElement).value);
    p[campo] = Number.isFinite(valor) && valor > 0 ? valor : undefined;
  }

  setVigencia(p: Producto, evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    p.ofertaVigencia = valor || null;
  }

  descto(p: Producto): number {
    if (!p.precioOferta || p.precioOferta >= p.costo) return 0;
    return Math.round((1 - p.precioOferta / p.costo) * 100);
  }

  async guardar(p: Producto) {
    if (!p.id) return;
    this.guardandoId.set(p.id);
    try {
      const ref = doc(this.firestore, `productos/${p.id}`);
      if (p.enOferta) {
        await updateDoc(ref, {
          enOferta: true,
          precioRegular: p.precioRegular,
          precioOferta: p.precioOferta,
          ofertaVigencia: p.ofertaVigencia || null,
        });
      } else {
        await updateDoc(ref, {
          enOferta: false,
          precioRegular: deleteField(),
          precioOferta: deleteField(),
          ofertaVigencia: deleteField(),
        });
      }
      this.mostrarMensaje(`Oferta guardada para "${p.nombre}"`, true);
    } catch (error) {
      console.error('Error al guardar la oferta:', error);
      this.mostrarMensaje('No se pudo guardar la oferta. Intenta de nuevo.', false);
    } finally {
      this.guardandoId.set(null);
    }
  }

  private mostrarMensaje(texto: string, ok: boolean) {
    if (this.timerMensaje) clearTimeout(this.timerMensaje);
    this.mensaje.set({ texto, ok });
    this.timerMensaje = setTimeout(() => this.mensaje.set(null), 4000);
  }
}