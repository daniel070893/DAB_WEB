import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';

import { ProductoDetalle } from './producto-detalle';

describe('ProductoDetalle', () => {
  let component: ProductoDetalle;
  let fixture: ComponentFixture<ProductoDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        { provide: Firestore, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'p1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductoDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
