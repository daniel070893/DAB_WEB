import { TestBed } from '@angular/core/testing';

import { CartService } from './cart.service';
import { Producto } from '../../public/catalogo/catalogo';

describe('CartService', () => {
  let service: CartService;

  const producto: Producto = {
    id: 'p1',
    nombre: 'Refacción X',
    detalle: 'Detalle',
    costo: 150,
    cveSat: 'C1',
    almacen: 'A1',
    existencia: 5,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CartService] });
    service = TestBed.inject(CartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('agrega una cantidad específica', () => {
    service.agregarCantidad(producto, 3);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].cantidad).toBe(3);
    expect(service.precioTotal()).toBe(450);
  });

  it('no rebasa la existencia', () => {
    service.agregarCantidad(producto, 10);
    expect(service.items()[0].cantidad).toBe(5);
  });

  it('acumula cantidades sin exceder la existencia', () => {
    service.agregarCantidad(producto, 3);
    service.agregarCantidad(producto, 5);
    expect(service.items()[0].cantidad).toBe(5);
  });

  it('agregarProducto añade de 1 en 1', () => {
    service.agregarProducto(producto);
    service.agregarProducto(producto);
    expect(service.items()[0].cantidad).toBe(2);
  });
});
