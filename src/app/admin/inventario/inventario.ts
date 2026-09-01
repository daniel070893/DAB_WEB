import { Component, inject, PLATFORM_ID, OnInit, signal, computed, NgZone, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc } from '@angular/fire/firestore';

import { Producto } from '../../core/models/producto';

interface Almacen {
  id: string;
  nombre: string;
}

interface FormularioProducto {
  idInterno: string;
  nombre: string;
  detalle: string;
  cveSat: string;
  almacen: string;
  numerosPieza: string;
  costo: number | null;
  existencia: number | null;
  urlsGaleria: string;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrl: './inventario.scss',
})
export class Inventario implements OnInit {
  private firestore = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private injector = inject(EnvironmentInjector);

  productos = signal<Producto[]>([]);
  cargando = signal(true);
  errorCargar = signal(false);

  modalAbierto = signal(false);
  editandoId = signal<string | null>(null);
  guardando = signal(false);

  productoAEliminar = signal<Producto | null>(null);

  mensaje = signal<{ texto: string; ok: boolean } | null>(null);
  private timerMensaje: ReturnType<typeof setTimeout> | null = null;

  alertaModal = signal<{ texto: string } | null>(null);

  // Catálogo de almacenes
  almacenes = signal<Almacen[]>([]);
  mostrarGestionAlmacenes = signal(false);
  almacenEditando = signal<string | null>(null);
  nombreAlmacenTmp = signal('');
  nuevoAlmacen = '';

  // Edición de existencias en línea, por grupo/almacén
  filaEditando = signal<string | null>(null);
  valorExistencia = signal<number>(0);

  // Productos agrupados por almacén (orden ascendente)
  grupos = computed(() => {
    const mapa = new Map<string, Producto[]>();
    for (const p of this.productos()) {
      const clave = ((p.almacen || '').trim() || 'SIN ALMACÉN').toUpperCase();
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(p);
    }
    return Array.from(mapa.entries())
      .map(([almacen, items]) => ({ almacen, items }))
      .sort((a, b) => a.almacen.localeCompare(b.almacen));
  });

  // Estado de despliegue de cada grupo/almacén (colapsado por defecto)
  gruposAbiertos = signal<Record<string, boolean>>({});

  toggleGrupo(almacen: string) {
    this.gruposAbiertos.update(m => ({ ...m, [almacen]: !m[almacen] }));
  }

  grupoAbierto(almacen: string): boolean {
    return !!this.gruposAbiertos()[almacen];
  }

  form: FormularioProducto = this.formularioVacio();

  async ngOnInit() {
    await this.cargarProductos();
    await this.cargarAlmacenes();
  }

  async cargarAlmacenes() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const snap = await runInInjectionContext(this.injector, async () => {
        return await getDocs(query(collection(this.firestore, 'almacenes')));
      });
      let lista = snap.docs
        .map(d => ({ id: d.id, nombre: ((d.data() as { nombre?: string }).nombre || '').trim().toUpperCase() }))
        .filter(a => a.nombre.length > 0);

      // Sembrar el catálogo con los almacenes ya en uso por los productos
      const existentes = new Set(lista.map(a => a.nombre));
      const faltantes = Array.from(
        new Set(this.productos().map(p => (p.almacen || '').trim().toUpperCase()).filter(Boolean))
      ).filter(n => !existentes.has(n));

      for (const nombre of faltantes) {
        const ref = await addDoc(collection(this.firestore, 'almacenes'), { nombre });
        lista.push({ id: ref.id, nombre });
      }

      lista = lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.ngZone.run(() => this.almacenes.set(lista));
    } catch (error) {
      console.error('Error al cargar almacenes:', error);
    }
  }

  async agregarAlmacen() {
    const nombre = (this.nuevoAlmacen ?? '').trim().toUpperCase();
    if (!nombre) return;
    if (this.almacenes().some(a => a.nombre === nombre)) {
      this.mostrarMensaje('Ese almacén ya existe.', false);
      return;
    }
    try {
      await addDoc(collection(this.firestore, 'almacenes'), { nombre });
      this.nuevoAlmacen = '';
      await this.cargarAlmacenes();
      this.mostrarMensaje('Almacén agregado.', true);
    } catch (error) {
      console.error('Error al agregar almacén:', error);
      this.mostrarMensaje('No se pudo agregar el almacén.', false);
    }
  }

  iniciarEdicionAlmacen(a: Almacen) {
    this.almacenEditando.set(a.id);
    this.nombreAlmacenTmp.set(a.nombre);
  }

  async guardarEdicionAlmacen(a: Almacen) {
    const nuevo = this.nombreAlmacenTmp().trim().toUpperCase();
    if (!nuevo) return;
    try {
      await updateDoc(doc(this.firestore, `almacenes/${a.id}`), { nombre: nuevo });
      if (this.form.almacen === a.nombre) this.form.almacen = nuevo;
      this.almacenEditando.set(null);
      await this.cargarAlmacenes();
      this.mostrarMensaje('Almacén actualizado.', true);
    } catch (error) {
      console.error('Error al renombrar almacén:', error);
      this.mostrarMensaje('No se pudo renombrar el almacén.', false);
    }
  }

  async eliminarAlmacen(a: Almacen) {
    try {
      await deleteDoc(doc(this.firestore, `almacenes/${a.id}`));
      if (this.form.almacen === a.nombre) this.form.almacen = '';
      await this.cargarAlmacenes();
      this.mostrarMensaje('Almacén eliminado.', true);
    } catch (error) {
      console.error('Error al eliminar almacén:', error);
      this.mostrarMensaje('No se pudo eliminar el almacén.', false);
    }
  }

  private formularioVacio(): FormularioProducto {
    return {
      idInterno: '',
      nombre: '',
      detalle: '',
      cveSat: '',
      almacen: '',
      numerosPieza: '',
      costo: null,
      existencia: 0,
      urlsGaleria: '',
    };
  }

  async cargarProductos() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargando.set(true);
    this.errorCargar.set(false);
    try {
      const docsSnapshot = await runInInjectionContext(this.injector, async () => {
        return await getDocs(query(collection(this.firestore, 'productos')));
      });
      this.ngZone.run(() => {
        const items = docsSnapshot.docs
          .map(d => ({ id: d.id, ...(d.data() ?? {}) } as Producto))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
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

  get editando(): boolean {
    return this.editandoId() !== null;
  }

  abrirAgregar() {
    this.form = this.formularioVacio();
    this.editandoId.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditar(p: Producto) {
    this.editandoId.set(p.id ?? null);
    this.form = {
      idInterno: p.id ?? '',
      nombre: p.nombre,
      detalle: p.detalle,
      cveSat: p.cveSat,
      almacen: (p.almacen || '').toUpperCase(),
      numerosPieza: (p.numeros_pieza ?? []).join(', '),
      costo: p.costo,
      existencia: p.existencia,
      urlsGaleria: (p.urlsGaleria ?? []).join('\n'),
    };
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.editandoId.set(null);
  }

  async guardar() {
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      const idInterno = (this.form.idInterno ?? '').trim().toUpperCase();
      const docId = this.editandoId() ?? (idInterno || this.generarId());

      // Al dar de alta, validar que el ID no exista ya en la base de datos.
      // El ID se normaliza a mayúsculas, así la validación es indistinta a
      // mayúsculas/minúsculas (filtro-001 == FILTRO-001).
      if (!this.editandoId() && idInterno) {
        const refExistente = doc(this.firestore, `productos/${idInterno}`);
        const snapExistente = await runInInjectionContext(this.injector, async () => {
          return await getDoc(refExistente);
        });
        if (snapExistente.exists()) {
          this.mostrarAlertaModal('El producto ya existe en la base de datos');
          this.guardando.set(false);
          return;
        }
      }

      // Al dar de alta, los datos de texto se guardan en mayúsculas.
      const aMayusculas = !this.editandoId();
      const norm = (v: string) => (aMayusculas ? (v ?? '').trim().toUpperCase() : (v ?? '').trim());

      const data = {
        nombre: norm(this.form.nombre),
        detalle: norm(this.form.detalle),
        cveSat: norm(this.form.cveSat),
        almacen: norm(this.form.almacen),
        numeros_pieza: this.parsearLista(this.form.numerosPieza).map(v => aMayusculas ? v.toUpperCase() : v),
        costo: Number(this.form.costo) || 0,
        existencia: Number(this.form.existencia) || 0,
        urlsGaleria: this.parsearLineas(this.form.urlsGaleria),
      };

      const ref = doc(this.firestore, `productos/${docId}`);
      if (this.editandoId()) {
        await updateDoc(ref, data);
      } else {
        await setDoc(ref, data);
      }

      await this.cargarProductos();
      this.cerrarModal();
      this.mostrarMensaje(
        this.editandoId() ? 'Producto actualizado.' : 'Producto agregado.',
        true
      );
    } catch (error) {
      console.error('Error al guardar el producto:', error);
      this.mostrarMensaje('No se pudo guardar el producto. Intenta de nuevo.', false);
    } finally {
      this.guardando.set(false);
    }
  }

  confirmarEliminar(p: Producto) {
    this.productoAEliminar.set(p);
  }

  cancelarEliminar() {
    this.productoAEliminar.set(null);
  }

  async eliminar() {
    const p = this.productoAEliminar();
    if (!p?.id) return;
    try {
      await deleteDoc(doc(this.firestore, `productos/${p.id}`));
      await this.cargarProductos();
      this.mostrarMensaje('Producto eliminado.', true);
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      this.mostrarMensaje('No se pudo eliminar el producto.', false);
    } finally {
      this.productoAEliminar.set(null);
    }
  }

  iniciarEdicionExistencia(p: Producto) {
    this.filaEditando.set(p.id ?? null);
    this.valorExistencia.set(p.existencia ?? 0);
  }

  cancelarEdicionExistencia() {
    this.filaEditando.set(null);
  }

  async guardarExistencia(p: Producto) {
    if (!p.id) return;
    try {
      await updateDoc(doc(this.firestore, `productos/${p.id}`), {
        existencia: Number(this.valorExistencia()) || 0,
      });
      await this.cargarProductos();
      this.filaEditando.set(null);
      this.mostrarMensaje('Existencias actualizadas.', true);
    } catch (error) {
      console.error('Error al actualizar la existencia:', error);
      this.mostrarMensaje('No se pudo actualizar la existencia.', false);
    }
  }

  private parsearLista(texto: string): string[] {
    return (texto ?? '')
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }

  private parsearLineas(texto: string): string[] {
    return (texto ?? '')
      .split('\n')
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }

  private generarId(): string {
    return `prod_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  private mostrarMensaje(texto: string, ok: boolean) {
    if (this.timerMensaje) clearTimeout(this.timerMensaje);
    this.mensaje.set({ texto, ok });
    this.timerMensaje = setTimeout(() => this.mensaje.set(null), 4000);
  }

  mostrarAlertaModal(texto: string) {
    this.alertaModal.set({ texto });
  }

  cerrarAlertaModal() {
    this.alertaModal.set(null);
  }
}