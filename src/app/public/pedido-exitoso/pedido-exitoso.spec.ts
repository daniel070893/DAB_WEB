import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';

import { PedidoExitoso } from './pedido-exitoso';

describe('PedidoExitoso', () => {
  let component: PedidoExitoso;
  let fixture: ComponentFixture<PedidoExitoso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PedidoExitoso],
      providers: [provideRouter([]), { provide: Firestore, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(PedidoExitoso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calcula el subtotal de un artículo', () => {
    expect(component.totalItem({ precioUnitario: 150, cantidad: 3 })).toBe(450);
  });
});
