import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

import { Pos } from './pos';

describe('Pos', () => {
  let component: Pos;
  let fixture: ComponentFixture<Pos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pos],
      providers: [
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Pos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
