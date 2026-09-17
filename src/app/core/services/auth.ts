import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, authState, User } from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom } from 'rxjs';
import { switchMap, map, catchError, tap, first, filter, shareReplay } from 'rxjs/operators';

export interface PerfilUsuario {
  uid: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'cliente';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);

  usuario$: Observable<PerfilUsuario | null>;
  usuarioActual = signal<PerfilUsuario | null>(null);

  // Indica si Firebase ya determinó el estado real de la sesión
  iniciado = signal(false);

  constructor() {
    this.usuario$ = authState(this.auth).pipe(
      switchMap((user: User | null) => {
        if (!user) {
          return of(null);
        }

        // Perfil de respaldo por si el documento de Firestore aún no existe o falla la lectura
        const perfilFallback: PerfilUsuario = {
          uid: user.uid,
          email: user.email || '',
          nombre: user.displayName || 'Sin nombre',
          rol: 'cliente'
        };

        const userRef = doc(this.firestore, `usuarios/${user.uid}`);
        return (docData(userRef) as Observable<PerfilUsuario | undefined>).pipe(
          map(perfil => perfil ?? perfilFallback),
          catchError(() => of(perfilFallback))
        );
      }),
      tap((perfil) => {
        this.ngZone.run(() => {
          this.usuarioActual.set(perfil);
          this.iniciado.set(true);
        });
        if (perfil) console.log('[Auth] usuario$ ->', { uid: perfil.uid, rol: perfil.rol });
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    if (isPlatformBrowser(this.platformId)) {
      this.usuario$.subscribe();

      // Lectura autoritativa del rol apenas se resuelve la sesión, para no
      // depender solo del listener en vivo (refleja cambios manuales en consola).
      // Nota: authState emite null primero; filtramos para esperar al usuario real.
      authState(this.auth).pipe(filter((u): u is User => !!u), first()).subscribe(() => {
        this.recargarPerfil();
      });

      // Procesar resultado en caso de login con redirect
      getRedirectResult(this.auth).then(async (credencial) => {
        if (credencial?.user) {
          const user = credencial.user;
          const userRef = doc(this.firestore, `usuarios/${user.uid}`);
          try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              const nuevoPerfil: PerfilUsuario = {
                uid: user.uid,
                email: user.email || '',
                nombre: user.displayName || 'Sin nombre',
                rol: 'cliente'
              };
              await setDoc(userRef, nuevoPerfil);
            }
          } catch (err) {
            console.error('Error guardando perfil tras redirect:', err);
          }
        }
      }).catch(() => {});
    }
  }

  // Obtiene el usuario actual esperando la respuesta de Firebase
  async getUsuarioActual(): Promise<PerfilUsuario | null> {
    if (this.iniciado()) {
      return this.usuarioActual();
    }
    return firstValueFrom(this.usuario$.pipe(first()));
  }

  // Lee el perfil directamente desde Firestore (fuente de verdad) y actualiza
  // el signal. Útil tras cambios manuales del rol o para no depender solo del
  // listener en vivo, que a veces no refleja ediciones hechas en la consola.
  async recargarPerfil(): Promise<PerfilUsuario | null> {
    let user = this.auth.currentUser;
    if (!user) {
      try {
        user = (await firstValueFrom(
          authState(this.auth).pipe(filter((u): u is User => !!u), first())
        )) as User | null;
      } catch {
        user = null;
      }
    }
    if (!user) {
      this.ngZone.run(() => {
        this.usuarioActual.set(null);
        this.iniciado.set(true);
      });
      return null;
    }

    const userRef = doc(this.firestore, `usuarios/${user.uid}`);
    try {
      const snap = await getDoc(userRef);
      const perfil: PerfilUsuario = snap.exists()
        ? ({ uid: user.uid, ...(snap.data() as object) } as PerfilUsuario)
        : {
            uid: user.uid,
            email: user.email || '',
            nombre: user.displayName || 'Sin nombre',
            rol: 'cliente',
          };
      this.ngZone.run(() => {
        this.usuarioActual.set(perfil);
        this.iniciado.set(true);
      });
      console.log('[Auth] perfil resuelto ->', { uid: user.uid, rol: perfil.rol, existe: snap.exists() });
      return perfil;
    } catch (error) {
      console.error('Error al recargar el perfil desde Firestore:', error);
      return this.usuarioActual();
    }
  }

  async loginConGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const credencial = await signInWithPopup(this.auth, provider);
      const user = credencial.user;
      
      const userRef = doc(this.firestore, `usuarios/${user.uid}`);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const nuevoPerfil: PerfilUsuario = {
          uid: user.uid,
          email: user.email || '',
          nombre: user.displayName || 'Sin nombre',
          rol: 'cliente'
        };
        await setDoc(userRef, nuevoPerfil);
      }
    } catch (error: any) {
      if (error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(this.auth, provider);
        } catch (redirectError) {
          console.error('Error en login con redirect', redirectError);
        }
      } else {
        console.error('Error en el login', error);
      }
    }
  }

  async logout() {
    await this.auth.signOut();
    this.ngZone.run(() => {
      this.usuarioActual.set(null);
    });
  }
}