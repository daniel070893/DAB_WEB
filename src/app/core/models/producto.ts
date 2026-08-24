export interface Producto {
  id?: string;
  almacen: string;
  costo: number;
  cveSat: string;
  detalle: string;
  existencia: number;
  nombre: string;
  numeros_pieza?: string[];
  urlsGaleria?: string[];
  enOferta?: boolean;
  precioRegular?: number;
  precioOferta?: number;
  ofertaVigencia?: string | null;
}

export function productoEnOfertaVigente(p: Producto): boolean {
  if (!p.enOferta || !p.precioOferta || p.existencia <= 0) return false;
  if (p.precioOferta >= p.costo) return false;
  if (p.ofertaVigencia) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(p.ofertaVigencia + 'T23:59:59');
    if (fin < hoy) return false;
  }
  return true;
}

export function productoCoincide(p: Producto, termino: string): boolean {
  const t = (termino || '').trim().toLowerCase();
  if (!t) return true;
  return [
    p.nombre,
    p.detalle,
    p.cveSat,
    p.almacen,
    ...(p.numeros_pieza ?? []),
  ].some(v => !!v && v.toLowerCase().includes(t));
}