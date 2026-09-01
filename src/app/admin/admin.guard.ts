import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../core/services/auth';

// Solo permite entrar al panel si el usuario tiene rol 'admin'
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const usuario = await authService.recargarPerfil();
  if (usuario?.rol !== 'admin') {
    router.navigate(['/']);
    return false;
  }
  return true;
};
