"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerEstatusFactura = exports.autofacturarTicket = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const db = admin.firestore();
// Credenciales de Facturama (configurar como variables de entorno en producción)
const FACTURAMA_USER = ((_a = functions.config().facturama) === null || _a === void 0 ? void 0 : _a.user) || 'TU_USUARIO_FACTURAMA';
const FACTURAMA_PASS = ((_b = functions.config().facturama) === null || _b === void 0 ? void 0 : _b.password) || 'TU_PASSWORD_FACTURAMA';
const FACTURAMA_BASE_URL = ((_c = functions.config().facturama) === null || _c === void 0 ? void 0 : _c.sandbox) === 'true'
    ? 'https://apisandbox.facturama.mx'
    : 'https://api.facturama.mx';
/**
 * Cloud Function: autofacturarTicket
 * Recibe los datos fiscales del cliente y el ID del ticket/pedido,
 * valida en Firestore, envía a Facturama y devuelve los enlaces de descarga.
 * Usa onRequest con CORS explícito para funcionar en el emulator.
 */
exports.autofacturarTicket = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e;
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
    const data = (_a = req.body) === null || _a === void 0 ? void 0 : _a.data;
    // Helper para lanzar error con código HTTP correcto
    function lanzarError(codigo, mensaje) {
        const errorCodeMap = {
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
        const errorBody = {
            message: errorObj.message,
            status: errorObj.httpErrorCode.canonicalName
        };
        if (errorObj.details) {
            errorBody.details = errorObj.details;
        }
        res.status(httpStatus).send({ error: errorBody });
    }
    // 1. Validar datos de entrada
    if (!(data === null || data === void 0 ? void 0 : data.ticketId) || !(data === null || data === void 0 ? void 0 : data.rfc) || !(data === null || data === void 0 ? void 0 : data.razonSocial) || !(data === null || data === void 0 ? void 0 : data.codigoPostal) || !(data === null || data === void 0 ? void 0 : data.usoCfdi) || !(data === null || data === void 0 ? void 0 : data.regimenFiscal)) {
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
    const ticketData = ticketSnap.data();
    // 3. Verificar si ya fue facturado
    if (ticketData.facturado) {
        lanzarError('already-exists', 'Esta compra ya fue facturada anteriormente.');
        return;
    }
    // 4. Mapear artículos al formato de Facturama
    const itemsFactura = ticketData.items.map((item) => {
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
    const payloadFactura = {
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
        const respuesta = await axios_1.default.post(`${FACTURAMA_BASE_URL}/2/cfdis`, payloadFactura, {
            headers: {
                'Authorization': `Basic ${authBase64}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        const facturaId = respuesta.data.Id;
        // 9. NUEVA PETICIÓN: Enviar factura por correo electrónico a Facturama
        // Facturama recibe el correo como parámetro en la URL
        const urlEnvio = `${FACTURAMA_BASE_URL}/2/cfdis?cfdiType=issued&cfdiId=${facturaId}&email=${data.email}`;
        await axios_1.default.post(urlEnvio, null, {
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
            const pdfResponse = await axios_1.default.get(`${FACTURAMA_BASE_URL}/3/cfdis/issued/pdf/${facturaId}`, {
                headers: { 'Authorization': `Basic ${authBase64}` },
                responseType: 'arraybuffer'
            });
            const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
            pdfUrl = `data:application/pdf;base64,${pdfBase64}`;
            // Descargar XML
            const xmlResponse = await axios_1.default.get(`${FACTURAMA_BASE_URL}/3/cfdis/issued/xml/${facturaId}`, {
                headers: { 'Authorization': `Basic ${authBase64}` },
                responseType: 'arraybuffer'
            });
            const xmlBase64 = Buffer.from(xmlResponse.data).toString('base64');
            xmlUrl = `data:application/xml;base64,${xmlBase64}`;
        }
        catch (downloadError) {
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
    }
    catch (error) {
        // Manejar errores de Facturama
        if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 401) {
            lanzarError('unauthenticated', 'Error de autenticación con Facturama. Contacta al administrador.');
            return;
        }
        if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 400) {
            const mensajeError = ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.Message) || 'Datos fiscales inválidos.';
            lanzarError('invalid-argument', `Error en los datos fiscales: ${mensajeError}`);
            return;
        }
        // Error interno genérico
        lanzarError('internal', 'Error al generar la factura. Intenta de nuevo o contacta soporte.');
    }
});
/**
 * Cloud Function: obtenerEstatusFactura
 * Consulta el estatus de una factura existente en Facturama.
 * Usa onRequest con CORS explícito para funcionar en el emulator.
 */
exports.obtenerEstatusFactura = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e;
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
    const data = (_a = req.body) === null || _a === void 0 ? void 0 : _a.data;
    // Helper para lanzar error con código HTTP correcto
    function lanzarError(codigo, mensaje) {
        const errorCodeMap = {
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
        const errorBody = {
            message: errorObj.message,
            status: errorObj.httpErrorCode.canonicalName
        };
        if (errorObj.details) {
            errorBody.details = errorObj.details;
        }
        res.status(httpStatus).send({ error: errorBody });
    }
    if (!(data === null || data === void 0 ? void 0 : data.facturaId)) {
        lanzarError('invalid-argument', 'Se requiere el ID de la factura.');
        return;
    }
    const authString = `${FACTURAMA_USER}:${FACTURAMA_PASS}`;
    const authBase64 = Buffer.from(authString).toString('base64');
    try {
        const respuesta = await axios_1.default.get(`${FACTURAMA_BASE_URL}/2/cfdis/${data.facturaId}`, {
            headers: { 'Authorization': `Basic ${authBase64}` },
            timeout: 15000
        });
        // Respuesta exitosa con CORS headers ya puestos
        res.status(200).send({ result: {
                id: respuesta.data.Id,
                status: respuesta.data.Status,
                fechaEmision: respuesta.data.Date,
                total: respuesta.data.Total
            } });
    }
    catch (error) {
        if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 401) {
            lanzarError('unauthenticated', 'Error de autenticación con Facturama.');
            return;
        }
        if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 400) {
            lanzarError('invalid-argument', ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.Message) || 'Datos fiscales inválidos.');
            return;
        }
        lanzarError('internal', 'No se pudo consultar la factura.');
    }
});
//# sourceMappingURL=index.js.map