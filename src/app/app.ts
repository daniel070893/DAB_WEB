import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth';
import { CartService } from './core/services/cart.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'mipos-web';

// 2. Inyectamos public cartService junto con tu authService
  constructor(
    public authService: AuthService,
    public cartService: CartService
  ) {}

  async login() {
    await this.authService.loginConGoogle();
  }

  async logout() {
    await this.authService.logout();
  }
}