import { Component, inject, PLATFORM_ID, OnInit, signal, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, query, doc, updateDoc } from '@angular/fire/firestore';

import { PerfilUsuario } from '../../core/services/auth';

type Rol = 'admin' | 'cliente';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios implements OnInit {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);

  perfiles = signal<PerfilUsuario[]>([]);
  cargando = signal(true);
  errorCargar = signal(false);

  guardandoId = signal<string | null>(null);
  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  private timerMensaje: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    await this.cargarUsuarios();
  }

  async cargarUsuarios() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargando.set(true);
    this.errorCargar.set(false);
    try {
      const docsSnapshot = await runInInjectionContext(this.injector, async () => {
        return await getDocs(query(collection(this.firestore, 'usuarios')));
      });
      this.ngZone.run(() => {
        const items = docsSnapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as PerfilUsuario))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.perfiles.set(items);
        this.cargando.set(false);
      });
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      this.ngZone.run(() => {
        this.errorCargar.set(true);
        this.cargando.set(false);
      });
    }
  }

  rol(u: PerfilUsuario): Rol {
    return u.rol === 'admin' ? 'admin' : 'cliente';
  }

  async cambiarRol(u: PerfilUsuario, rol: string) {
    if (!u.uid || this.guardandoId() === u.uid) return;
    this.guardandoId.set(u.uid);
    try {
      await updateDoc(doc(this.firestore, `usuarios/${u.uid}`), { rol });
      this.perfiles.update(list =>
        list.map(p => (p.uid === u.uid ? { ...p, rol: rol as Rol } : p))
      );
      this.mostrarMensaje(`Rol de ${u.nombre || u.email} actualizado a "${rol}".`, true);
    } catch (error) {
      console.error('Error al cambiar el rol:', error);
      this.mostrarMensaje('No se pudo cambiar el rol. Intenta de nuevo.', false);
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