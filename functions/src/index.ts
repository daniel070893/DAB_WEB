import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

// Credenciales de Facturama (configurar como variables de entorno en producción)
const FACTURAMA_USER = functions.config().facturama?.user || 'TU_USUARIO_FACTURAMA';
const FACTURAMA_PASS = functions.config().facturama?.password || 'TU_PASSWORD_FACTURAMA';
const FACTURAMA_BASE_URL = functions.config().facturama?.sandbox === 'true'
  ? 'https://apisandbox.facturama.mx'
  : 'https://api.facturama.mx';

// Interfaces para TypeScript
interface ItemFactura {
  ProductCode: string;
  Description: string;
  UnitCode: string;
  UnitPrice: number;
  Quantity: number;
  Subtotal: number;
  Taxes: Array<{
    Name: string;
    Rate: number;
    Total: number;
    Base: number;
    IsRetention: boolean;
  }>;
  Total: number;
}

interface PayloadFactura {
  ExpeditionPlace: string;
  PaymentForm: string;
  PaymentMethod: string;
  CfdiType: string;
  Receiver: {
    Rfc: string;
    Name: string;
    CfdiUse: string;
    FiscalRegime: string;
    TaxZipCode: string;
  };
  Items: ItemFactura[];
}

interface DatosFacturaRequest {
  ticketId: string;
  rfc: string;
  razonSocial: string;
  codigoPostal: string;
  usoCfdi: string;
  regimenFiscal: string;
  email: string;
}

/**
 * Cloud Function: autofacturarTicket
 * Recibe los datos fiscales del cliente y el ID del ticket/pedido,
 * valida en Firestore, envía a Facturama y devuelve los enlaces de descarga.
 * Usa onRequest con CORS explícito para funcionar en el emulator.
 */
export const autofacturarTicket = functions.https.onRequest(
  async (req, res) => {
    // Aplicar CORS explícito
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Parsear datos del cuerpo (formato callable: { data: { ... } })
    const data = req.body?.data as DatosFacturaRequest | undefined;

    // Helper para lanzar error con código HTTP correcto
    function lanzarError(codigo: 'invalid-argument' | 'unauthenticated' | 'permission-denied' | 'not-found' | 'already-exists' | 'aborted' | 'resource-exhausted' | 'internal' | 'unavailable' | 'data-loss' | 'deadline-exceeded' | 'unimplemented' | 'cancelled', mensaje: string) {
      const errorCodeMap: Record<string, number> = {
        'invalid-argument': 400,
        'failed-precondition': 400,
        'out-of-range': 400,
        'unauthenticated': 401,
        'permission-denied': 403,
        'not-found': 404,
        'already-exists': 409,
        'aborted': 409,
        'resource-exhausted': 429,
        'internal': 500,
        'unavailable': 503,
        'data-loss': 500,
        'deadline-exceeded': 504,
        'unimplemented': 501,
        'cancelled': 499,
      };
      const httpStatus = errorCodeMap[codigo] || 500;
      const errorObj = new functions.https.HttpsError(codigo, mensaje);
      // Construir respuesta de error manualmente para evitar problemas de TypeScript con el property 'details'
      const errorBody: any = {
        message: errorObj.message,
        status: errorObj.httpErrorCode.canonicalName
      };
      if (errorObj.details) {
        errorBody.details = errorObj.details;
      }
      res.status(httpStatus).send({ error: errorBody });
    }

    // 1. Validar datos de entrada
    if (!data?.ticketId || !data?.rfc || !data?.razonSocial || !data?.codigoPostal || !data?.usoCfdi || !data?.regimenFiscal) {
      lanzarError('invalid-argument', 'Faltan campos obligatorios: ticketId, rfc, razonSocial, codigoPostal, usoCfdi, regimenFiscal');
      return;
    }

    // Validar RFC (12 caracteres persona moral, 13 persona física)
    const rfc = data.rfc.toUpperCase().trim();
    if (rfc.length < 12 || rfc.length > 13) {
      lanzarError('invalid-argument', 'El RFC debe tener 12 o 13 caracteres.');
      return;
    }

    // 2. Buscar el pedido/ticket en Firestore
    const ticketRef = db.collection('pedidos').doc(data.ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      lanzarError('not-found', 'El folio de compra no existe. Verifica el número.');
      return;
    }

    const ticketData = ticketSnap.data()!;

    // 3. Verificar si ya fue facturado
    if (ticketData.facturado) {
      lanzarError('already-exists', 'Esta compra ya fue facturada anteriormente.');
      return;
    }

    // 4. Mapear artículos al formato de Facturama
    const itemsFactura: ItemFactura[] = ticketData.items.map((item: any) => {
      const subtotal = item.precioUnitario * item.cantidad;
      const iva = subtotal * 0.16;

      return {
        ProductCode: item.claveSat || '25170000', // Partes automotrices por defecto
        Description: `${item.nombre} - ${item.detalle || ''}`.trim(),
        UnitCode: 'H87', // Pieza
        UnitPrice: item.precioUnitario,
        Quantity: item.cantidad,
        Subtotal: subtotal,
        Taxes: [{
          Name: 'IVA',
          Rate: 0.16,
          Total: iva,
          Base: subtotal,
          IsRetention: false
        }],
        Total: subtotal + iva
      };
    });

    // 5. Calcular totales
    const subtotalGeneral = itemsFactura.reduce((acc, item) => acc + item.Subtotal, 0);
    const ivaGeneral = itemsFactura.reduce((acc, item) => acc + item.Taxes[0].Total, 0);
    const totalGeneral = subtotalGeneral + ivaGeneral;

    // 6. Construir payload para Facturama
    const payloadFactura: PayloadFactura = {
      ExpeditionPlace: '72000', // CP de la empresa (configurar)
      PaymentForm: '01', // Efectivo
      PaymentMethod: 'PUE', // Pago en una sola exhibición
      CfdiType: 'I', // Ingreso
      Receiver: {
        Rfc: rfc,
        Name: data.razonSocial.toUpperCase().trim(),
        CfdiUse: data.usoCfdi,
        FiscalRegime: data.regimenFiscal,
        TaxZipCode: data.codigoPostal
      },
      Items: itemsFactura
    };

    try {
      // 7. Autenticación con Facturama
      const authString = `${FACTURAMA_USER}:${FACTURAMA_PASS}`;
      const authBase64 = Buffer.from(authString).toString('base64');

      // 8. Enviar CFDI a Facturama
      const respuesta = await axios.post(
        `${FACTURAMA_BASE_URL}/2/cfdis`,
        payloadFactura,
        {
          headers: {
            'Authorization': `Basic ${authBase64}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const facturaId = respuesta.data.Id;

      // 9. NUEVA PETICIÓN: Enviar factura por correo electrónico a Facturama
      // Facturama recibe el correo como parámetro en la URL
      const urlEnvio = `${FACTURAMA_BASE_URL}/2/cfdis?cfdiType=issued&cfdiId=${facturaId}&email=${data.email}`;
      await axios.post(urlEnvio, null, {
        headers: {
          'Authorization': `Basic ${authBase64}`
        }
      });

      // 10. Marcar el ticket como facturado en Firestore
      await ticketRef.update({
        facturado: true,
        facturaId: facturaId,
        correoFacturacion: data.email, // Guardamos el correo para tu historial
        fechaFacturacion: admin.firestore.FieldValue.serverTimestamp(),
        datosFacturacion: {
          rfc: rfc,
          razonSocial: data.razonSocial,
          regimenFiscal: data.regimenFiscal,
          usoCfdi: data.usoCfdi,
          codigoPostal: data.codigoPostal
        }
      });

      // 11. Descargar PDF y XML de Facturama
      let pdfUrl = '';
      let xmlUrl = '';

      try {
        // Descargar PDF
        const pdfResponse = await axios.get(
          `${FACTURAMA_BASE_URL}/3/cfdis/issued/pdf/${facturaId}`,
          {
            headers: { 'Authorization': `Basic ${authBase64}` },
            responseType: 'arraybuffer'
          }
        );
        const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
        pdfUrl = `data:application/pdf;base64,${pdfBase64}`;

        // Descargar XML
        const xmlResponse = await axios.get(
          `${FACTURAMA_BASE_URL}/3/cfdis/issued/xml/${facturaId}`,
          {
            headers: { 'Authorization': `Basic ${authBase64}` },
            responseType: 'arraybuffer'
          }
        );
        const xmlBase64 = Buffer.from(xmlResponse.data).toString('base64');
        xmlUrl = `data:application/xml;base64,${xmlBase64}`;
      } catch (downloadError) {
        console.warn('Error descargando archivos de Facturama:', downloadError);
        // Si falla la descarga directa, intentar con URLs del portal
        pdfUrl = `https://portal.facturama.mx/CFDI/PDF/${facturaId}`;
        xmlUrl = `https://portal.facturama.mx/CFDI/XML/${facturaId}`;
      }

      // Respuesta exitosa con CORS headers ya puestos
      res.status(200).send({ result: {
        exito: true,
        mensaje: 'Factura generada y enviada exitosamente',
        facturaId: facturaId,
        pdf: pdfUrl,
        xml: xmlUrl,
        total: totalGeneral,
        fecha: new Date().toISOString()
      } });

    } catch (error: any) {
      // Manejar errores de Facturama
      if (error.response?.status === 401) {
        lanzarError('unauthenticated', 'Error de autenticación con Facturama. Contacta al administrador.');
        return;
      }

      if (error.response?.status === 400) {
        const mensajeError = error.response?.data?.Message || 'Datos fiscales inválidos.';
        lanzarError('invalid-argument', `Error en los datos fiscales: ${mensajeError}`);
        return;
      }

      // Error interno genérico
      lanzarError('internal', 'Error al generar la factura. Intenta de nuevo o contacta soporte.');
    }
  }
);

/**
 * Cloud Function: obtenerEstatusFactura
 * Consulta el estatus de una factura existente en Facturama.
 * Usa onRequest con CORS explícito para funcionar en el emulator.
 */
export const obtenerEstatusFactura = functions.https.onRequest(
  async (req, res) => {
    // Aplicar CORS explícito
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Parsear datos del cuerpo (formato callable: { data: { ... } })
    const data = req.body?.data as { facturaId: string } | undefined;

    // Helper para lanzar error con código HTTP correcto
    function lanzarError(codigo: 'invalid-argument' | 'unauthenticated' | 'permission-denied' | 'not-found' | 'already-exists' | 'aborted' | 'resource-exhausted' | 'internal' | 'unavailable' | 'data-loss' | 'deadline-exceeded' | 'unimplemented' | 'cancelled', mensaje: string) {
      const errorCodeMap: Record<string, number> = {
        'invalid-argument': 400,
        'failed-precondition': 400,
        'out-of-range': 400,
        'unauthenticated': 401,
        'permission-denied': 403,
        'not-found': 404,
        'already-exists': 409,
        'aborted': 409,
        'resource-exhausted': 429,
        'internal': 500,
        'unavailable': 503,
        'data-loss': 500,
        'deadline-exceeded': 504,
        'unimplemented': 501,
        'cancelled': 499,
      };
      const httpStatus = errorCodeMap[codigo] || 500;
      const errorObj = new functions.https.HttpsError(codigo, mensaje);
      // Construir respuesta de error manualmente para evitar problemas de TypeScript con el property 'details'
      const errorBody: any = {
        message: errorObj.message,
        status: errorObj.httpErrorCode.canonicalName
      };
      if (errorObj.details) {
        errorBody.details = errorObj.details;
      }
      res.status(httpStatus).send({ error: errorBody });
    }

    if (!data?.facturaId) {
      lanzarError('invalid-argument', 'Se requiere el ID de la factura.');
      return;
    }

    const authString = `${FACTURAMA_USER}:${FACTURAMA_PASS}`;
    const authBase64 = Buffer.from(authString).toString('base64');

    try {
      const respuesta = await axios.get(
        `${FACTURAMA_BASE_URL}/2/cfdis/${data.facturaId}`,
        {
          headers: { 'Authorization': `Basic ${authBase64}` },
          timeout: 15000
        }
      );

      // Respuesta exitosa con CORS headers ya puestos
      res.status(200).send({ result: {
        id: respuesta.data.Id,
        status: respuesta.data.Status,
        fechaEmision: respuesta.data.Date,
        total: respuesta.data.Total
      } });

    } catch (error: any) {
      if (error.response?.status === 401) {
        lanzarError('unauthenticated', 'Error de autenticación con Facturama.');
        return;
      }

      if (error.response?.status === 400) {
        lanzarError('invalid-argument', error.response?.data?.Message || 'Datos fiscales inválidos.');
        return;
      }

      lanzarError('internal', 'No se pudo consultar la factura.');
    }
  }
);