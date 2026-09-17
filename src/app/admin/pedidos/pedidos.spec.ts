import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';

import { Pedidos } from './pedidos';

describe('Pedidos', () => {
  let component: Pedidos;
  let fixture: ComponentFixture<Pedidos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pedidos],
      providers: [{ provide: Firestore, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(Pedidos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filtra por origen', () => {
    const pedidos = [
      { id: '1', origen: 'web' },
      { id: '2', origen: 'pos' },
    ] as any[];

    component.cambiarFiltro('pos');
    expect(component.filtrar(pedidos)).toEqual([pedidos[1]]);

    component.cambiarFiltro('todos');
    expect(component.filtrar(pedidos)).toEqual(pedidos);
  });
});
