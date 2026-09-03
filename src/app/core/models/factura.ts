export interface DatosFacturacion {
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  usoCfdi: string;
  emailFiscal: string;
  telefono?: string;
  direccion?: {
    calle: string;
    numeroExterior: string;
    numeroInterior?: string;
    colonia: string;
    codigoPostal: string;
    ciudad: string;
    estado: string;
    pais: string;
  };
}

export const REGIMENES_FISCALES = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', descripcion: 'Ingresos por intereses' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
];

export const USOS_CFDI = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G02', descripcion: 'Adquisición de materiales, aparatos y útiles para el trabajo' },
  { clave: 'G03', descripcion: 'Adquisición de muebles y equipo de computo' },
  { clave: 'G04', descripcion: 'Adquisición de equipo de transporte' },
  { clave: 'G05', descripcion: 'Adquisición de equipo de cómputo y accesorios' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'I02', descripcion: 'Maquinaria y equipo' },
  { clave: 'I03', descripcion: 'Equipo de cómputo y accesorios' },
  { clave: 'I04', descripcion: 'Herramientas' },
  { clave: 'I05', descripcion: 'Trocas y camionetas' },
  { clave: 'D01', descripcion: 'Gastos médicos, dentales y hospitalarios' },
  { clave: 'S01', descripcion: 'Gastos en general' },
];
