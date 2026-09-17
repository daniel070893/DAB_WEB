import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  DatosFacturacion,
  REGIMENES_FISCALES,
  USOS_CFDI
} from '../../core/models/factura';

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './facturacion.html',
  styleUrls: ['./facturacion.scss']
})
export class FacturacionComponent {
  datosFacturacion = signal<DatosFacturacion>({
    razonSocial: '',
    rfc: '',
    regimenFiscal: '',
    usoCfdi: '',
    emailFiscal: ''
  });

  requerirDireccion = signal(false);
  mostrarDireccion = signal(false);

  regimenFiscalSeleccionado = signal('');
  usoCfdiSeleccionado = signal('');

  readonly guardado = output<DatosFacturacion>();
  readonly cancelado = output<void>();

  get regimenesFiscales() {
    return REGIMENES_FISCALES;
  }

  get usosCfdi() {
    return USOS_CFDI;
  }

  actualizarCampo(campo: keyof DatosFacturacion, valor: string) {
    this.datosFacturacion.update(d => ({ ...d, [campo]: valor }));
  }

  actualizarDireccion(campo: string, valor: string) {
    this.datosFacturacion.update(d => {
      const direccion = d.direccion || {
        calle: '',
        numeroExterior: '',
        colonia: '',
        codigoPostal: '',
        ciudad: '',
        estado: '',
        pais: 'México'
      };
      return { ...d, direccion: { ...direccion, [campo]: valor } };
    });
  }

  toggleDireccion() {
    this.mostrarDireccion.update(v => !v);
    if (this.mostrarDireccion()) {
      this.requerirDireccion.set(true);
    }
  }

  esValido(): boolean {
    const d = this.datosFacturacion();
    return !!(
      d.razonSocial.trim() &&
      d.rfc.trim() &&
      d.regimenFiscal &&
      d.usoCfdi &&
      d.emailFiscal.trim()
    );
  }

  onGuardar() {
    if (!this.esValido()) return;
    this.guardado.emit(this.datosFacturacion());
  }

  onCancelar() {
    this.cancelado.emit();
  }
}
