// ============================================================
// DATA.JS — GPS Internacional v5 — Datos reales 2026
// Casetas: ~180 plazas CAPUFE con tarifa automóvil vigente
// Fuente: CAPUFE tarifas publicadas abril 2026
// Coordenadas: punto exacto sobre la autopista de cuota
// ============================================================

const VEHICLE_FACTORS = {
  auto:   { tolls: 1.0,  fuel: 1.0,  label: 'Automóvil'           },
  moto:   { tolls: 0.5,  fuel: 0.45, label: 'Motocicleta'         },
  camion: { tolls: 2.8,  fuel: 3.5,  label: 'Camión / Autobús'    },
  taxi:   { tolls: 1.0,  fuel: 1.0,  label: 'Taxi / Autos alquiler'},
};

// Consumo real en autopista (~8-9 L/100km = 0.08-0.09 L/km)
// Precio gasolina Magna México: ~$24.50/L (IEPS 2026)
const FUEL_BY_COUNTRY = {
  MX:      { priceMXN: 24.50, priceUSD: 1.29, consumption: 0.088, currency: 'MXN', symbol: '$'  },
  US:      { priceMXN: null,  priceUSD: 0.98,  consumption: 0.085, currency: 'USD', symbol: '$'  },
  ES:      { priceMXN: null,  priceUSD: 1.68,  consumption: 0.075, currency: 'EUR', symbol: '€'  },
  FR:      { priceMXN: null,  priceUSD: 1.78,  consumption: 0.075, currency: 'EUR', symbol: '€'  },
  DE:      { priceMXN: null,  priceUSD: 1.82,  consumption: 0.075, currency: 'EUR', symbol: '€'  },
  AR:      { priceMXN: null,  priceUSD: 0.78,  consumption: 0.090, currency: 'ARS', symbol: '$'  },
  CO:      { priceMXN: null,  priceUSD: 0.57,  consumption: 0.090, currency: 'COP', symbol: '$'  },
  BR:      { priceMXN: null,  priceUSD: 1.12,  consumption: 0.090, currency: 'BRL', symbol: 'R$' },
  CL:      { priceMXN: null,  priceUSD: 1.10,  consumption: 0.085, currency: 'CLP', symbol: '$'  },
  PE:      { priceMXN: null,  priceUSD: 0.85,  consumption: 0.090, currency: 'PEN', symbol: 'S/' },
  DEFAULT: { priceMXN: null,  priceUSD: 1.20,  consumption: 0.088, currency: 'USD', symbol: '$'  },
};

let FUEL = { ...FUEL_BY_COUNTRY.MX };

// ============================================================
// ============================================================
// CASETAS DE CUOTA — México, tarifas vigentes desde 13/abr/2026
// 
// Bloque 1: Red FONADIN operada DIRECTAMENTE por CAPUFE.
//   Fuente oficial: pot.capufe.mx/.../Tarifas-vigentes-2026.pdf
//   Solo plazas DIRECTAS/principales (se omiten fracciones
//   intermedias I1/I2, que son tramos parciales de la misma
//   caseta física, no casetas adicionales).
//
// Bloque 2: Autopistas de cuota concesionadas a privados que
//   NO administra CAPUFE pero sí cobran peaje real en ruta
//   (ej. Mérida-Cancún, concesión EXI Operadora Quantum).
//   Cada una indica su fuente y operador en el comentario.
// ============================================================
const TOLL_BOOTHS = [
  { id:'cua-aca-01', name:'Tlalpan', lat:19.242553626817934, lng:-99.14856559535049, autoMXN:149, state:'Ciudad de México', highway:'95D', priceNote:'Tarifa fija' },
  { id:'aer-95d-01', name:'Aeropuerto', lat:18.80236558308715, lng:-99.22106245498676, autoMXN:15, state:'Morelos', highway:'95D', priceNote:'Tarifa fija' },
  { id:'emz-95d-01', name:'Emiliano Zapata', lat:18.837457866140007, lng:-99.2153855980045, autoMinMXN:7, autoMaxMXN:10, state:'Morelos', highway:'95D', priceNote:'Tarifa variable por tramo' },
  { id:'xoc-95d-01', name:'Xochitepec', lat:18.775059297954993, lng:-99.22526201685297, autoMinMXN:9, autoMaxMXN:32, state:'Morelos', highway:'95D', priceNote:'Tarifa variable por tramo' },
  { id:'cua-aca-03', name:'Alpuyeca', lat:18.72241436868589, lng:-99.25993599102819, autoMinMXN:31, autoMaxMXN:65, state:'Morelos', highway:'95D', priceNote:'Tarifa variable por tramo' },
  { id:'vel-95d-01', name:'Ing. Francisco Velasco Durán', lat:18.69842358284641, lng:-99.27820323374975, autoMXN:95, state:'Morelos', highway:'95D', priceNote:'Tarifa fija' },
  { id:'cua-aca-04', name:'Paso Morelos', lat:18.231453788946467, lng:-99.2154194897653, autoMinMXN:76, autoMaxMXN:200, state:'Guerrero', highway:'95D', priceNote:'Tarifa variable por tramo' },
  { id:'cua-aca-05', name:'Palo Blanco', lat:17.42401193757371, lng:-99.46689592333551, autoMXN:182, state:'Guerrero', highway:'95D', priceNote:'Tarifa fija' },
  { id:'cua-aca-06', name:'La Venta', lat:16.928346611008106, lng:-99.80192575100362, autoMXN:163, state:'Guerrero', highway:'95D', priceNote:'Tarifa fija' },
  { id:'cor-ver-01', name:'Cuitláhuac', lat:18.865, lng:-96.728, autoMXN:146, state:'Veracruz', highway:'150D' },
  { id:'cor-ver-02', name:'Paso del Toro', lat:19.075, lng:-96.235, autoMXN:136, state:'Veracruz', highway:'150D' },
  { id:'tin-cos-01', name:'Cosamaloapan', lat:18.407, lng:-95.8, autoMXN:290, state:'Veracruz', highway:'145D' },
  { id:'tin-cos-02', name:'Acayucan', lat:17.91013866389674, lng:-94.93727412299832, autoMXN:96, state:'Veracruz', highway:'145D' },
  { id:'qro-libNE-01', name:'Chichimequillas', lat:20.738, lng:-100.366, autoMXN:65, state:'Querétaro', highway:'57D Libr.NE' },
  { id:'salt-lib-01', name:'Ojo Caliente', lat:25.469, lng:-100.897, autoMXN:53, state:'Coahuila', highway:'Libr. Saltillo' },
  { id:'carb-pm-01', name:'Los Chorros', lat:24.893, lng:-101.417, autoMXN:82, state:'Coahuila', highway:'57D' },
  { id:'carb-pm-02', name:'Huachichil', lat:24.608, lng:-101.182, autoMXN:62, state:'Coahuila', highway:'57D' },
  { id:'tampico-01', name:'Tampico (Libramiento)', lat:22.236, lng:-97.923, autoMXN:39, state:'Tamaulipas', highway:'Libr. Pte. Tampico' },
  { id:'camp-01', name:'Seybaplaya', lat:19.647, lng:-90.692, autoMXN:99, state:'Campeche', highway:'180D' },
  { id:'chamapa-01', name:'Chamapa', lat:19.518, lng:-99.328, autoMXN:69, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'chamapa-02', name:'Cipreses', lat:19.538, lng:-99.292, autoMXN:62, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'chamapa-03', name:'San Mateo Nopala', lat:19.498, lng:-99.305, autoMXN:60, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'chamapa-04', name:'Madín', lat:19.505, lng:-99.258, autoMXN:64, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'chamapa-05', name:'Atizapán', lat:19.561, lng:-99.247, autoMXN:45, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'chamapa-06', name:'Lomas Verdes', lat:19.578, lng:-99.282, autoMXN:61, state:'Estado de México', highway:'Chamapa-Lechería' },
  { id:'son-01', name:'Estación Don', lat:27.082, lng:-109.438, autoMXN:114, state:'Sonora', highway:'15D' },
  { id:'son-02', name:'Fundición', lat:27.167, lng:-109.672, autoMXN:114, state:'Sonora', highway:'15D' },
  { id:'son-03', name:'Esperanza (Son.)', lat:27.77, lng:-110.496, autoMXN:114, state:'Sonora', highway:'15D' },
  { id:'son-04', name:'Guaymas (Libramiento)', lat:27.942, lng:-110.898, autoMXN:48, state:'Sonora', highway:'15D' },
  { id:'son-05', name:'Hermosillo', lat:29.024, lng:-111.008, autoMXN:114, state:'Sonora', highway:'15D' },
  { id:'son-06', name:'Magdalena (Libramiento)', lat:30.619, lng:-110.965, autoMXN:38, state:'Sonora', highway:'15D' },
  { id:'gp-dgo-01', name:'Bermejillo', lat:25.855, lng:-103.498, autoMXN:161, state:'Durango', highway:'40D' },
  { id:'gp-dgo-02', name:'Ceballos', lat:26.526, lng:-103.961, autoMXN:183, state:'Durango', highway:'40D' },
  { id:'tor-salt-01', name:'La Cuchilla', lat:25.68, lng:-103.23, autoMXN:100, state:'Coahuila', highway:'40D' },
  { id:'tor-salt-02', name:'Plan de Ayala', lat:25.534, lng:-101.07, autoMXN:176, state:'Coahuila', highway:'40D' },
  { id:'agua-card-01', name:'La Venta (Agua Dulce)', lat:18.145, lng:-93.798, autoMXN:106, state:'Tabasco', highway:'180D' },
  { id:'ixtla-igu-01', name:'Iguala', lat:18.346, lng:-99.539, autoMXN:112, state:'Guerrero', highway:'95D' },
  { id:'mor-cuau-01', name:'La Pera-Cuautla', lat:18.999, lng:-99.066, autoMXN:86, state:'Morelos', highway:'160D' },
  { id:'mor-cuau-02', name:'Tepoztlán', lat:18.985, lng:-99.098, autoMXN:33, state:'Morelos', highway:'160D' },
  { id:'mor-cuau-03', name:'Oaxtepec', lat:18.902, lng:-98.967, autoMXN:46, state:'Morelos', highway:'160D' },
  { id:'mor-cuau-04', name:'Oacalco', lat:18.809, lng:-98.955, autoMXN:33, state:'Morelos', highway:'160D' },
  { id:'zac-rv-01', name:'Zacapalco', lat:18.13, lng:-99.631, autoMXN:46, state:'Guerrero', highway:'95D' },
  { id:'tih-gz-01', name:'Totomoxtle', lat:20.694, lng:-97.431, autoMXN:60, state:'Veracruz', highway:'180D' },
  { id:'chiapas-01', name:'Las Choapas', lat:17.918, lng:-93.846, autoMXN:105, state:'Veracruz', highway:'195D' },
  { id:'chiapas-02', name:'Malpasito', lat:17.492, lng:-93.735, autoMXN:106, state:'Tabasco', highway:'195D' },
  { id:'chiapas-03', name:'Ocozocoautla', lat:16.756, lng:-93.376, autoMXN:106, state:'Chiapas', highway:'195D' },
  { id:'mex-qro-01', name:'Tepotzotlán', lat:19.705, lng:-99.228, autoMXN:113, state:'Estado de México', highway:'57D' },
  { id:'mex-qro-02', name:'Jorobas', lat:19.805, lng:-99.355, autoMXN:74, state:'Estado de México', highway:'57D' },
  { id:'mex-qro-03', name:'Palmillas', lat:20.258, lng:-99.961, autoMXN:113, state:'Querétaro', highway:'57D' },
  { id:'mex-qro-04', name:'Polotitlán', lat:20.207, lng:-99.835, autoMXN:103, state:'Querétaro', highway:'57D' },
  { id:'qro-irap-01', name:'Querétaro (57D-45D)', lat:20.644, lng:-100.412, autoMXN:107, state:'Querétaro', highway:'45D', priceNote:'Tarifa fija' },
  { id:'qro-irap-02', name:'Apaseo', lat:20.565, lng:-100.628, autoMXN:49, state:'Guanajuato', highway:'45D' },
  { id:'qro-irap-03', name:'Salamanca', lat:20.571, lng:-100.98, autoMXN:73, state:'Guanajuato', highway:'45D' },
  { id:'qro-irap-04', name:'Villagrán', lat:20.529, lng:-101.047, autoMXN:42, state:'Guanajuato', highway:'45D' },
  { id:'qro-irap-05', name:'Cerro Gordo', lat:20.498, lng:-100.774, autoMXN:61, state:'Guanajuato', highway:'45D' },
  { id:'mex-pue-01', name:'Chalco', lat:19.264, lng:-98.899, autoMXN:26, state:'Estado de México', highway:'150D', priceNote:'Tarifa fija' },
  { id:'mex-pue-02', name:'Ixtapaluca', lat:19.322, lng:-98.885, autoMXN:26, state:'Estado de México', highway:'150D' },
  { id:'mex-pue-03', name:'San Marcos', lat:19.216, lng:-98.454, autoMXN:173, state:'Estado de México', highway:'150D' },
  { id:'mex-pue-04', name:'San Martín Texmelucan', lat:19.282, lng:-98.429, autoMXN:53, state:'Puebla', highway:'150D' },
  { id:'pue-acatz-01', name:'Amozoc', lat:19.048, lng:-98.057, autoMXN:94, state:'Puebla', highway:'150D' },
  { id:'acatz-cm-01', name:'Esperanza', lat:18.846, lng:-97.396, autoMXN:178, state:'Puebla', highway:'150D' },
  { id:'cm-cor-01', name:'Fortín', lat:18.918, lng:-97.01, autoMXN:43, state:'Veracruz', highway:'150D' },
  { id:'teh-oax-01', name:'Tehuacán', lat:18.644, lng:-97.447, autoMXN:58, state:'Puebla', highway:'135D', priceNote:'Tarifa fija' },
  { id:'teh-oax-02', name:'Miahuatlán', lat:18.327, lng:-97.568, autoMXN:42, state:'Oaxaca', highway:'135D' },
  { id:'teh-oax-03', name:'Suchixtlahuaca', lat:17.799, lng:-97.276, autoMXN:99, state:'Oaxaca', highway:'135D' },
  { id:'teh-oax-04', name:'Huitzo', lat:17.293, lng:-96.852, autoMXN:114, state:'Oaxaca', highway:'135D' },
  { id:'tij-ens-01', name:'Playas', lat:32.422, lng:-117.085, autoMXN:50, state:'Baja California', highway:'1D' },
  { id:'tij-ens-02', name:'Rosarito', lat:32.287, lng:-117.027, autoMXN:49, state:'Baja California', highway:'1D' },
  { id:'tij-ens-03', name:'Ensenada', lat:31.89, lng:-116.642, autoMXN:53, state:'Baja California', highway:'1D' },
  { id:'taxco-01', name:'Taxco', lat:18.526, lng:-99.628, autoMXN:19, state:'Guerrero', highway:'95D' },
  { id:'rum-tec-01', name:'El Hongo', lat:32.497, lng:-116.23, autoMXN:108, state:'Baja California', highway:'2D' },
  { id:'sal-vent-01', name:'Tehuantepec', lat:16.167, lng:-95.198, autoMXN:49, state:'Oaxaca', highway:'185D' },
  { id:'sal-vent-02', name:'Ixtepec', lat:16.567, lng:-95.085, autoMXN:100, state:'Oaxaca', highway:'185D' },
  { id:'dgo-maz-01', name:'Durango (Libramiento)', lat:24.027, lng:-104.715, autoMXN:84, state:'Durango', highway:'40D' },
  { id:'dgo-maz-02', name:'Llano Grande', lat:23.97, lng:-104.952, autoMXN:126, state:'Durango', highway:'40D' },
  { id:'dgo-maz-03', name:'Coscomate', lat:23.757, lng:-105.464, autoMXN:399, state:'Durango', highway:'40D' },
  { id:'dgo-maz-04', name:'Mesillas', lat:23.209, lng:-105.997, autoMXN:211, state:'Sinaloa', highway:'40D' },
  { id:'lag-slp-01', name:'Lagos de Moreno', lat:21.744, lng:-101.447, autoMXN:146, state:'San Luis Potosí', highway:'80D' },
  { id:'ozumba-01', name:'Ozumba', lat:19.048, lng:-98.756, autoMXN:66, state:'Estado de México', highway:'115D' },
  { id:'acap-lib-01', name:'Libramiento Poniente Acapulco', lat:16.898, lng:-99.887, autoMXN:58, state:'Guerrero', highway:'Libr. Pte. Acapulco' },
  { id:'vhsa-lib-01', name:'Loma de Caballo', lat:17.987, lng:-92.987, autoMXN:77, state:'Tabasco', highway:'Libr. Villahermosa' },
  { id:'chih-lib-01', name:'Ent. Sacramento', lat:28.692, lng:-106.027, autoMXN:91, state:'Chihuahua', highway:'Libr. Ote. Chihuahua' },
  { id:'oax-vent-01', name:'Barranca Larga', lat:16.842, lng:-96.978, autoMXN:245, state:'Oaxaca', highway:'Barranca Larga-Ventanilla' },
  { id:'oax-vent-02', name:'Ventanilla', lat:16.073, lng:-97.862, autoMXN:245, state:'Oaxaca', highway:'Barranca Larga-Ventanilla' },
  { id:'cv-tamuin-01', name:'La Calera', lat:22.092, lng:-98.954, autoMXN:128, state:'San Luis Potosí', highway:'70D' },
  { id:'chapalilla-01', name:'Compostela', lat:21.204436243012903, lng:-104.88637815109784, autoMXN:104, state:'Nayarit', highway:'15D', priceNote:'Tarifa fija' },
  { id:'zacatecas-01', name:'Zacatecas', lat:22.673, lng:-102.535, autoMXN:44, state:'Zacatecas', highway:'45D' },
  { id:'pte-zacatal', name:'El Zacatal', lat:18.647, lng:-91.809, autoMXN:114, state:'Campeche', highway:'Puente Nacional' },

  // ── Autopista Mérida–Cancún (180D) — NO es CAPUFE federal ──
  // Concesión privada: construida por Consorcio del Mayab/ICA,
  // operada por EXI Operadora Quantum hasta 2050.
  // Fuente: SCT (app.sct.gob.mx, vía idVia=52) y Diario de Yucatán,
  // tarifas vigentes desde el 13 de abril de 2026.
  { id:'mer-can-01', name:'Kantunil',   lat:20.8240, lng:-89.0540, autoMXN:100, state:'Yucatán',      highway:'180D Mérida-Cancún' },
  { id:'mer-can-02', name:'Nuevo Xcan', lat:20.6230, lng:-87.4990, autoMXN:237, state:'Quintana Roo',  highway:'180D Mérida-Cancún' },
];


// ============================================================
// ZONAS DE RIESGO — Datos SESNSP / SSPC 2024
// ============================================================
const RISK_ZONES = [
  { id:'r01', name:'Guerrero (Tierra Caliente)',  lat:18.5000, lng:-100.6000, radius:45, level:'extreme', description:'Región con mayor índice de violencia. Múltiples grupos criminales operando.' },
  { id:'r02', name:'Colima',                      lat:19.1234, lng:-103.7241, radius:25, level:'extreme', description:'Estado más violento per cápita en varios años. Disputa territorial activa.' },
  { id:'r03', name:'Zacatecas Norte',             lat:23.5000, lng:-102.5000, radius:40, level:'extreme', description:'Corredor de disputa. Zacatecas lidera homicidios per cápita 2024.' },
  { id:'r04', name:'Acapulco',                    lat:16.8634, lng:-99.8809,  radius:20, level:'extreme', description:'Acapulco entre primeros lugares de homicidios dolosos.' },
  { id:'r05', name:'Iguala – Guerrero',           lat:18.3454, lng:-99.5393,  radius:15, level:'high',    description:'Zona de alta incidencia delictiva.' },
  { id:'r06', name:'Uruapan – Michoacán',         lat:19.4196, lng:-102.0574, radius:20, level:'extreme', description:'Fuerte presencia de crimen organizado. Una de las ciudades más violentas.' },
  { id:'r07', name:'Zamora – Michoacán',          lat:19.9867, lng:-102.2833, radius:15, level:'high',    description:'Altos índices de homicidio y extorsión.' },
  { id:'r08', name:'Apatzingán',                  lat:19.0865, lng:-102.3519, radius:12, level:'extreme', description:'Tierra Caliente Michoacán — zona de alto riesgo.' },
  { id:'r09', name:'Tijuana – BC',                lat:32.5149, lng:-117.0382, radius:22, level:'high',    description:'Miles de homicidios registrados. Mayor violencia en zonas periféricas.' },
  { id:'r10', name:'Ensenada – BC',               lat:31.8667, lng:-116.5966, radius:12, level:'medium',  description:'Incidencia media-alta de delitos.' },
  { id:'r11', name:'Celaya – Guanajuato',         lat:20.5234, lng:-100.8154, radius:18, level:'extreme', description:'Guanajuato lidera robos con violencia. Celaya zona crítica.' },
  { id:'r12', name:'Salamanca – Guanajuato',      lat:20.5731, lng:-101.1935, radius:12, level:'high',    description:'Alta presencia criminal y huachicoleros.' },
  { id:'r13', name:'León – Guanajuato',           lat:21.1244, lng:-101.6863, radius:15, level:'medium',  description:'Índice de robos y extorsiones elevado.' },
  { id:'r14', name:'Tlaquepaque – Jalisco',       lat:20.6424, lng:-103.3108, radius:14, level:'high',    description:'Alta incidencia delictiva en área metropolitana GDL.' },
  { id:'r15', name:'Coatzacoalcos – Ver.',        lat:18.1500, lng:-94.4500,  radius:14, level:'high',    description:'Alta incidencia de homicidios y extorsión en zona industrial.' },
  { id:'r16', name:'Juárez – Chihuahua',          lat:31.6904, lng:-106.4245, radius:20, level:'high',    description:'Ciudad Juárez — alta incidencia de violencia y tráfico.' },
  { id:'r17', name:'Reynosa – Tamaulipas',        lat:26.0797, lng:-98.2954,  radius:16, level:'extreme', description:'Tamaulipas con alertas de viaje nivel 4 (USA). Crimen organizado activo.' },
  { id:'r18', name:'Matamoros – Tamaulipas',      lat:25.8693, lng:-97.5036,  radius:12, level:'extreme', description:'Zona fronteriza con alta peligrosidad.' },
  { id:'r19', name:'Nuevo Laredo',                lat:27.4767, lng:-99.5167,  radius:12, level:'high',    description:'Ciudad fronteriza — actividad de crimen organizado.' },
  { id:'r20', name:'Ecatepec – Edomex',           lat:19.6010, lng:-99.0503,  radius:16, level:'high',    description:'Mayor incidencia de robos en ZMC México.' },
  { id:'r21', name:'Valle de Chalco',             lat:19.2943, lng:-98.9544,  radius:12, level:'high',    description:'Alto índice de asalto a transporte y robo a transeúnte.' },
  { id:'r22', name:'Iztapalapa – CDMX',           lat:19.3574, lng:-99.0573,  radius:12, level:'medium',  description:'Alta tasa de robos en zona comercial.' },
  { id:'r23', name:'Tepito – CDMX',               lat:19.4476, lng:-99.1333,  radius:4,  level:'high',    description:'Zona de alto riesgo — Barrio Bravo.' },
  { id:'r24', name:'Culiacán – Sinaloa',          lat:24.8091, lng:-107.3940, radius:18, level:'high',    description:'Culiacán con altos índices de homicidio.' },
  { id:'r25', name:'Fresnillo – Zacatecas',       lat:23.1716, lng:-102.8706, radius:12, level:'extreme', description:'Fresnillo entre los municipios más peligrosos de México.' },
  { id:'r26', name:'Aguililla – Michoacán',       lat:18.7370, lng:-102.7870, radius:10, level:'extreme', description:'Epicentro de disputas entre grupos criminales.' },
  { id:'r27', name:'Chilpancingo – Guerrero',     lat:17.5500, lng:-99.5000,  radius:12, level:'high',    description:'Capital de Guerrero con alta incidencia delictiva.' },
  { id:'r28', name:'Tampico – Tamaulipas',        lat:22.2475, lng:-97.8567,  radius:10, level:'medium',  description:'Incidencia media en zona portuaria.' },
];

// ============================================================
// CIUDADES PARA AUTOCOMPLETE
// ============================================================
const MX_CITIES = [
  { name:'Ciudad de México',    state:'CDMX',               lat:19.4326,  lng:-99.1332,  country:'MX' },
  { name:'Guadalajara',         state:'Jalisco',             lat:20.6597,  lng:-103.3496, country:'MX' },
  { name:'Monterrey',           state:'Nuevo León',          lat:25.6866,  lng:-100.3161, country:'MX' },
  { name:'Puebla',              state:'Puebla',              lat:19.0414,  lng:-98.2063,  country:'MX' },
  { name:'Tijuana',             state:'Baja California',     lat:32.5149,  lng:-117.0382, country:'MX' },
  { name:'León',                state:'Guanajuato',          lat:21.1244,  lng:-101.6863, country:'MX' },
  { name:'Juárez',              state:'Chihuahua',           lat:31.6904,  lng:-106.4245, country:'MX' },
  { name:'Mérida',              state:'Yucatán',             lat:20.9674,  lng:-89.5926,  country:'MX' },
  { name:'San Luis Potosí',     state:'San Luis Potosí',     lat:22.1565,  lng:-100.9855, country:'MX' },
  { name:'Aguascalientes',      state:'Aguascalientes',      lat:21.8853,  lng:-102.2916, country:'MX' },
  { name:'Hermosillo',          state:'Sonora',              lat:29.0729,  lng:-110.9559, country:'MX' },
  { name:'Saltillo',            state:'Coahuila',            lat:25.4232,  lng:-100.9896, country:'MX' },
  { name:'Mexicali',            state:'Baja California',     lat:32.6245,  lng:-115.4523, country:'MX' },
  { name:'Culiacán',            state:'Sinaloa',             lat:24.8091,  lng:-107.3940, country:'MX' },
  { name:'Acapulco',            state:'Guerrero',            lat:16.8634,  lng:-99.8809,  country:'MX' },
  { name:'Tepic',               state:'Nayarit',             lat:21.5042,  lng:-104.8953, country:'MX' },
  { name:'Chihuahua',           state:'Chihuahua',           lat:28.6353,  lng:-106.0889, country:'MX' },
  { name:'Morelia',             state:'Michoacán',           lat:19.7060,  lng:-101.1950, country:'MX' },
  { name:'Querétaro',           state:'Querétaro',           lat:20.5888,  lng:-100.3878, country:'MX' },
  { name:'Veracruz',            state:'Veracruz',            lat:19.1814,  lng:-96.1429,  country:'MX' },
  { name:'Cancún',              state:'Quintana Roo',        lat:21.1743,  lng:-86.8466,  country:'MX' },
  { name:'Toluca',              state:'Estado de México',    lat:19.2926,  lng:-99.6573,  country:'MX' },
  { name:'Torreón',             state:'Coahuila',            lat:25.5428,  lng:-103.4068, country:'MX' },
  { name:'Durango',             state:'Durango',             lat:24.0277,  lng:-104.6532, country:'MX' },
  { name:'Oaxaca',              state:'Oaxaca',              lat:17.0732,  lng:-96.7266,  country:'MX' },
  { name:'Zacatecas',           state:'Zacatecas',           lat:22.7709,  lng:-102.5832, country:'MX' },
  { name:'Colima',              state:'Colima',              lat:19.2437,  lng:-103.7241, country:'MX' },
  { name:'Manzanillo',          state:'Colima',              lat:19.0535,  lng:-104.3319, country:'MX' },
  { name:'La Paz',              state:'Baja California Sur', lat:24.1426,  lng:-110.3128, country:'MX' },
  { name:'Villahermosa',        state:'Tabasco',             lat:17.9892,  lng:-92.9475,  country:'MX' },
  { name:'Tuxtla Gutiérrez',    state:'Chiapas',             lat:16.7516,  lng:-93.1152,  country:'MX' },
  { name:'San Cristóbal',       state:'Chiapas',             lat:16.7369,  lng:-92.6376,  country:'MX' },
  { name:'Playa del Carmen',    state:'Quintana Roo',        lat:20.6296,  lng:-87.0739,  country:'MX' },
  { name:'Mazatlán',            state:'Sinaloa',             lat:23.2494,  lng:-106.4111, country:'MX' },
  { name:'Puerto Vallarta',     state:'Jalisco',             lat:20.6534,  lng:-105.2253, country:'MX' },
  { name:'Tultepec',            state:'Estado de México',    lat:19.6916,  lng:-99.1280,  country:'MX' },
  { name:'Pachuca',             state:'Hidalgo',             lat:20.1011,  lng:-98.7591,  country:'MX' },
  { name:'Reynosa',             state:'Tamaulipas',          lat:26.0797,  lng:-98.2954,  country:'MX' },
  { name:'Matamoros',           state:'Tamaulipas',          lat:25.8693,  lng:-97.5036,  country:'MX' },
  { name:'Nuevo Laredo',        state:'Tamaulipas',          lat:27.4767,  lng:-99.5167,  country:'MX' },
  { name:'Tampico',             state:'Tamaulipas',          lat:22.2475,  lng:-97.8567,  country:'MX' },
  { name:'Uruapan',             state:'Michoacán',           lat:19.4196,  lng:-102.0574, country:'MX' },
  { name:'Zamora',              state:'Michoacán',           lat:19.9867,  lng:-102.2833, country:'MX' },
  { name:'Irapuato',            state:'Guanajuato',          lat:20.6740,  lng:-101.3574, country:'MX' },
  { name:'Celaya',              state:'Guanajuato',          lat:20.5234,  lng:-100.8154, country:'MX' },
  { name:'Chetumal',            state:'Quintana Roo',        lat:18.5001,  lng:-88.3000,  country:'MX' },
  { name:'Cuernavaca',          state:'Morelos',             lat:18.9242,  lng:-99.2216,  country:'MX' },
  { name:'Lázaro Cárdenas',     state:'Michoacán',           lat:17.9579,  lng:-102.1877, country:'MX' },
  { name:'Piedras Negras',      state:'Coahuila',            lat:28.7000,  lng:-100.5240, country:'MX' },
  { name:'Nogales',             state:'Sonora',              lat:31.3208,  lng:-110.9340, country:'MX' },
];

// ============================================================
// ZONAS HORARIAS MÉXICO
// ============================================================
const MX_TIMEZONES = [
  { zone:'America/Mexico_City',  label:'Centro (UTC-6)',        states:['CDMX','Estado de México','Jalisco','Nuevo León','Puebla','Veracruz','Hidalgo','Guanajuato','Oaxaca','Querétaro','San Luis Potosí','Tabasco','Tamaulipas','Tlaxcala','Guerrero','Morelos','Aguascalientes','Colima','Michoacán','Nayarit','Durango','Zacatecas','Chiapas','Campeche','Yucatán','Chihuahua'] },
  { zone:'America/Hermosillo',   label:'Pacífico (UTC-7)',       states:['Sonora'] },
  { zone:'America/Tijuana',      label:'Pacífico Norte (UTC-8)', states:['Baja California'] },
  { zone:'America/La_Paz',       label:'Montaña (UTC-7)',        states:['Baja California Sur','Sinaloa'] },
  { zone:'America/Cancun',       label:'Sureste (UTC-6 fijo)',   states:['Quintana Roo'] },
];

function getTimezoneForState(state) {
  for (const tz of MX_TIMEZONES) {
    if (tz.states.includes(state)) return tz;
  }
  return MX_TIMEZONES[0];
}

// ============================================================
// DETECCIÓN DE PAÍS
// ============================================================
function detectCountry(lat, lng) {
  if (lat >= 14.5 && lat <= 32.7 && lng >= -117.1 && lng <= -86.7) return 'MX';
  if (lat >= 24.4 && lat <= 49.4 && lng >= -125.0 && lng <= -66.9) return 'US';
  if (lat >= 35.9 && lat <= 43.8 && lng >= -9.3   && lng <=  4.3)  return 'ES';
  if (lat >= 41.3 && lat <= 51.1 && lng >= -5.1   && lng <=  9.6)  return 'FR';
  if (lat >= 47.3 && lat <= 55.1 && lng >=  6.0   && lng <= 15.0)  return 'DE';
  if (lat >= -55  && lat <= -21.8 && lng >= -73.6  && lng <= -34.0) return 'BR';
  if (lat >= -55  && lat <= -21.8 && lng >= -73.6  && lng <= -53.7) return 'AR';
  if (lat >= -4.2 && lat <= 12.5  && lng >= -77.0  && lng <= -66.9) return 'CO';
  if (lat >= -55  && lat <= -17.5 && lng >= -75.7  && lng <= -66.4) return 'PE';
  if (lat >= -55  && lat <= -17.5 && lng >= -75.6  && lng <= -66.0) return 'CL';
  return 'DEFAULT';
}

function getFuelForRoute(originLat, originLng, destLat, destLng) {
  const c = detectCountry(originLat, originLng);
  return FUEL_BY_COUNTRY[c] || FUEL_BY_COUNTRY.DEFAULT;
}
