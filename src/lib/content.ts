/** All Spanish site copy in one file. Retiro address and schedule are NOT here: they come live from the sheet's Config tab. */

export const SITE_NAME = "Monolab Print Studio";

export const HERO = {
  eyebrow: "Santiago, Chile",
  title: "Impresión 3D en resina para",
  accent: "odontología",
  text: "Modelos de estudio, guías y piezas dentales impresos con precisión. Suba sus archivos 3D, revise su modelo y reciba su cotización por correo. Retiro en nuestro estudio.",
  cta: "Solicitar cotización",
};

export const ABOUT = {
  title: "Quiénes somos",
  paragraphs: [
    "Monolab Print Studio es un servicio de impresión 3D en resina orientado principalmente al trabajo odontológico, con sede en Santiago, Chile.",
    "Imprimimos en una Anycubic Photon Mono 4 Ultra, calibrada, con un volumen máximo de 153,4 × 77,0 × 165,0 mm.",
  ],
  representative: {
    name: "Antonio Alvear Muñoz",
    role: "Odontólogo",
    label: "Representante",
    registro: "727145",
    run: "19.069.824-6",
    photo: "/brand/antonio-alvear.jpg",
  },
};

export const NAV = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#como", label: "Cómo funciona" },
  { href: "#pedido", label: "Pedido" },
  { href: "#materiales", label: "Materiales" },
  { href: "#faq", label: "FAQ" },
  { href: "#contacto", label: "Contacto" },
];

export const STEPS = [
  { title: "Suba y configure", text: "Cargue sus archivos 3D y elija la resina y el plazo." },
  {
    title: "Confirme su cotización",
    text: "Le enviamos el valor por correo. Confírmelo con un clic.",
  },
  { title: "Lo imprimimos", text: "Le avisamos cuando esté listo para el retiro." },
];

export const MATERIALS = [
  {
    name: "Resina Estándar",
    text: "Para modelos de estudio o impresiones simples.",
    uses: ["Modelos de estudio", "Modelos de trabajo", "Prototipos"],
  },
  {
    name: "Resina Tough",
    text: "Para piezas delicadas o que requieren manipulación.",
    uses: ["Guías y piezas funcionales"],
  },
  {
    name: "Nuestro equipo",
    text: "Anycubic Photon Mono 4 Ultra, calibrada. Volumen máximo: 153,4 × 77,0 × 165,0 mm.",
    uses: [],
  },
];

export const RESIN_OPTIONS = [
  {
    value: "Estándar",
    label: "Estándar",
    hint: "Modelos de estudio o impresiones simples.",
  },
  {
    value: "Resina Tough",
    label: "Tough",
    hint: "Piezas delicadas o que requieren manipulación.",
  },
];

export const MACHINE = { name: "Anycubic Photon Mono 4 Ultra", volume: "153,4 × 77,0 × 165,0 mm" };

export const FAQ = [
  {
    q: "¿Qué formato de archivo necesito?",
    a: "Archivos STL, OBJ o PLY, hasta 10 por solicitud y 95 MB cada uno.",
  },
  {
    q: "¿Cómo funciona la cotización?",
    a: "Revisamos sus archivos y le enviamos el valor por correo, con un enlace para confirmarlo.",
  },
  {
    q: "¿Qué pasa si mi modelo es más grande que el volumen de impresión?",
    a: "El visor lo ajusta automáticamente y usted puede cambiar la escala.",
  },
  {
    q: "¿Cómo recibo mi pedido?",
    a: "Retiro en nuestro estudio en Santiago. Le avisamos por correo cuando esté listo.",
  },
  {
    q: "¿Qué datos del paciente necesitan?",
    a: "Solo las iniciales, para proteger sus datos. No solicitamos el nombre completo del paciente.",
  },
  {
    q: "¿Dónde y por cuánto tiempo se almacenan mis modelos?",
    a: "Sus modelos se almacenan de forma segura en una carpeta privada de Google Drive de Monolab Print Studio, con acceso restringido a nuestro equipo. Se conservan únicamente durante el tiempo necesario para realizar la impresión. Una vez finalizado el pedido, los archivos se destruyen y eliminan de forma definitiva por razones de seguridad.",
  },
  {
    q: "¿Cuánto demora?",
    a: "Usted elige: Flash en 2 días (10.000 CLP por pedido) o Normal en 7 días (7.500 CLP por pedido). Avisamos cada etapa por correo.",
  },
];

export const ENTREGA_LABELS: Record<string, { title: string; fee: string }> = {
  Flash: { title: "Flash · 2 días", fee: "10.000 CLP por pedido" },
  Normal: { title: "Normal · 7 días", fee: "7.500 CLP por pedido" },
};

export const PUBLIC_EMAIL = "contacto@monolabprintstudio.cl";

export const MESSAGES = {
  sendError: "No pudimos enviar su solicitud. Inténtelo nuevamente o escríbanos por WhatsApp.",
  uploadError: "No pudimos subir este archivo. Inténtelo nuevamente.",
  parseError: "No pudimos leer este archivo. Quítelo o súbalo de nuevo.",
  badType: "Solo aceptamos archivos STL, OBJ o PLY.",
  tooBig: (mb: number) => `Supera el máximo de ${mb} MB.`,
  tooMany: "Puede subir hasta 10 archivos por solicitud.",
};
