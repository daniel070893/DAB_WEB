import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';

import { REGIMENES_FISCALES, USOS_CFDI } from '../../core/models/factura';

interface ResultadoFactura {
  exito: boolean;
  mensaje: string;
  facturaId: string;
  pdf: string;
  xml: string;
  total: number;
  fecha: string;
}

@Component({
  selector: 'app-autofacturacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './autofacturacion.html',
  styleUrls: ['./autofacturacion.scss']
})
export class Autofacturacion {
  private fb = inject(FormBuilder);
  private functions = inject(Functions);

  facturaForm: FormGroup;
  cargando = signal(false);
  resultadoFactura = signal<ResultadoFactura | null>(null);
  errorMensaje = signal('');
  emailFacturacion = signal('');

  regimenesFiscales = REGIMENES_FISCALES;
  usosCfdi = USOS_CFDI;

  constructor() {
    this.facturaForm = this.fb.group({
      ticketId: ['', [Validators.required, Validators.minLength(6)]],
      rfc: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(13)]],
      razonSocial: ['', [Validators.required, Validators.minLength(3)]],
      codigoPostal: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5)]],
      regimenFiscal: ['612', Validators.required],
      usoCfdi: ['G03', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async generarFactura() {
    if (this.facturaForm.invalid) {
      this.facturaForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set('');

    try {
      const formValue = this.facturaForm.value;

      const datosFactura = {
        ticketId: formValue.ticketId.trim(),
        rfc: formValue.rfc.toUpperCase().trim(),
        razonSocial: formValue.razonSocial.toUpperCase().trim(),
        codigoPostal: formValue.codigoPostal.trim(),
        regimenFiscal: formValue.regimenFiscal,
        usoCfdi: formValue.usoCfdi,
        email: formValue.email
      };

      const autofacturar = httpsCallable(this.functions, 'autofacturarTicket');
      const result = await autofacturar(datosFactura);

      this.resultadoFactura.set(result.data as ResultadoFactura);
      this.emailFacturacion.set(formValue.email);
    } catch (error: any) {
      console.error('Error al generar factura:', error);

      if (error?.code === 'functions/not-found') {
        this.errorMensaje.set('El folio de compra no existe. Verifica el número.');
      } else if (error?.code === 'functions/already-exists') {
        this.errorMensaje.set('Esta compra ya fue facturada anteriormente.');
      } else if (error?.code === 'functions/invalid-argument') {
        this.errorMensaje.set(error.message || 'Datos fiscales inválidos.');
      } else if (error?.code === 'functions/unauthenticated') {
        this.errorMensaje.set('Error de autenticación. Contacta al administrador.');
      } else {
        this.errorMensaje.set('No se pudo generar la factura. Verifica tus datos e intenta de nuevo.');
      }
    } finally {
      this.cargando.set(false);
    }
  }

  limpiarFormulario() {
    this.facturaForm.reset({
      ticketId: '',
      rfc: '',
      razonSocial: '',
      codigoPostal: '',
      regimenFiscal: '612',
      usoCfdi: 'G03',
      email: ''
    });
    this.resultadoFactura.set(null);
    this.errorMensaje.set('');
    this.emailFacturacion.set('');
  }

  convertirMayusculas(campo: string) {
    const control = this.facturaForm.get(campo);
    if (control) {
      control.setValue(control.value.toUpperCase(), { emitEvent: false });
    }
  }

  get f() {
    return this.facturaForm.controls;
  }
}
