import { ApplicationConfig, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

// Importaciones de Firebase
import { initializeApp, provideFirebaseApp, FirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

// Pega aquí las credenciales exactas de tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0LdmYacKodvhPBwHSEmur8cd7at7H2nw",
  authDomain: "mipos-5811e.firebaseapp.com",
  projectId: "mipos-5811e",
  storageBucket: "mipos-5811e.firebasestorage.app",
  messagingSenderId: "105132151413",
  appId: "1:105132151413:web:30ed669f4b469709515e3c"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), 
    provideClientHydration(),
    // Proveedores de Firebase
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => {
      const app = inject(FirebaseApp);
      // En el navegador: Auth con persistencia local para que la sesión se
      // guarde en localStorage y se restaure automáticamente al recargar la página.
      if (isPlatformBrowser(inject(PLATFORM_ID))) {
        return initializeAuth(app, {
          persistence: browserLocalPersistence,
          popupRedirectResolver: browserPopupRedirectResolver,
        });
      }
      // En el servidor (SSR/prerender) no hay sesión que restaurar: usamos getAuth().
      return getAuth(app);
    }),
    provideFirestore(() => getFirestore())
  ]
};
