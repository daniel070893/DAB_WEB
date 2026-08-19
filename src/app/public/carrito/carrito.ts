import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { CartService, ItemCarrito } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth';
import { PedidoService } from '../../core/services/pedido.service';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './carrito.html',
  styleUrls: ['./carrito.scss']
})
export class Carrito {
  public cartService = inject(CartService);
  private authService = inject(AuthService);
  private pedidoService = inject(PedidoService);
  private router = inject(Router);

  mostrarLogin = false;
  loginCargando = false;
  mostrarCheckout = false;
  procesandoPago = false;
  errorPago: string | null = null;

  readonly placeholderMini = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="#eeeeee" width="48" height="48"/></svg>`
  );

  aumentar(item: ItemCarrito) {
    this.cartService.agregarProducto(item.producto);
  }

  disminuir(item: ItemCarrito) {
    if (item.producto.id) {
      this.cartService.disminuirProducto(item.producto.id);
    }
  }

  eliminar(item: ItemCarrito) {
    if (item.producto.id) {
      this.cartService.removerProducto(item.producto.id);
    }
  }

  limpiar() {
    this.cartService.limpiarCarrito();
  }

  subtotal(costo: number, cantidad: number): number {
    return costo * cantidad;
  }

  async confirmarPedido() {
    const usuario = await this.authService.getUsuarioActual();
    if (!usuario) {
      this.mostrarLogin = true;
      return;
    }
    this.abrirCheckout();
  }

  async iniciarSesionParaPagar() {
    if (this.loginCargando) return;
    this.loginCargando = true;
    try {
      await this.authService.loginConGoogle();
      const usuario = await this.authService.getUsuarioActual();
      if (usuario) {
        this.mostrarLogin = false;
        this.abrirCheckout();
      }
    } finally {
      this.loginCargando = false;
    }
  }

  cerrarLogin() {
    this.mostrarLogin = false;
  }

  private abrirCheckout() {
    this.errorPago = null;
    this.mostrarCheckout = true;
  }

  cerrarCheckout() {
    if (this.procesandoPago) return;
    this.mostrarCheckout = false;
  }

  async pagar() {
    if (this.procesandoPago) return;
    this.procesandoPago = true;
    this.errorPago = null;
    try {
      // Simula la espera de aprobación de Mercado Pago (backend simulado)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const usuario = await this.authService.getUsuarioActual();
      if (!usuario) {
        throw new Error('Sesión no disponible');
      }

      const pedido = await this.pedidoService.procesarPedido(usuario);
      this.mostrarCheckout = false;
      this.cartService.limpiarCarrito();
      this.router.navigate(['/pedido-exitoso'], { state: { pedido } });
    } catch (error) {
      console.error('Error al procesar el pago', error);
      this.errorPago = 'No se pudo completar el pago. Intenta de nuevo.';
    } finally {
      this.procesandoPago = false;
    }
  }
}
