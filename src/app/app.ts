import { Component, inject, PLATFORM_ID, OnInit, signal, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { Firestore, collection, getDocs, query } from '@angular/fire/firestore';

import { AuthService } from './core/services/auth';
import { CartService } from './core/services/cart.service';
import { BusquedaService } from './core/services/busqueda.service';
import { Producto, productoEnOfertaVigente } from './core/models/producto';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  title = 'mipos-web';

  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);
  private busquedaService = inject(BusquedaService);

  cantidadOfertas = signal(0);

  constructor(
    public authService: AuthService,
    public cartService: CartService
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.cargarOfertas();
    }
  }

  private async cargarOfertas() {
    try {
      const docsSnapshot = await runInInjectionContext(this.injector, async () => {
        return await getDocs(query(collection(this.firestore, 'productos')));
      });
      const total = docsSnapshot.docs.filter(doc => {
        const prod = { id: doc.id, ...doc.data() } as Producto;
        return productoEnOfertaVigente(prod);
      }).length;
      this.ngZone.run(() => this.cantidadOfertas.set(total));
    } catch (error) {
      console.error('Error al cargar ofertas:', error);
    }
  }

  get terminoBusqueda() {
    return this.busquedaService.termino;
  }

  setBusqueda(valor: string) {
    this.busquedaService.termino.set(valor);
  }

  limpiarBusqueda() {
    this.busquedaService.termino.set('');
  }

  async login() {
    await this.authService.loginConGoogle();
  }

  async logout() {
    await this.authService.logout();
  }
}