const DEFAULT_SERVICES = [
  {
    id: "lash-lifting",
    name: "Lash Lifting",
    image: "assets/lash-lifting.jpg",
    applicationPrice: 95,
    maintenancePrice: null,
    priceText: "Aplicação R$ 95",
    maintenanceLabel: "Sem manutenção",
    description: "Curvatura natural dos cílios, com acabamento leve e elegante.",
    durationMinutes: 120,
    featured: false,
    active: true,
    sortOrder: 10
  },
  {
    id: "fio-a-fio",
    name: "Fio a Fio",
    image: "assets/fio-a-fio.jpg",
    applicationPrice: 90,
    maintenancePrice: null,
    priceText: "Aplicação R$ 90",
    maintenanceLabel: "Sem manutenção",
    description: "Resultado discreto para realçar o olhar no dia a dia.",
    durationMinutes: 120,
    featured: false,
    active: true,
    sortOrder: 20
  },
  {
    id: "volume-brasileiro",
    name: "Volume Brasileiro",
    image: "assets/volume-brasileiro.jpg",
    applicationPrice: 100,
    maintenancePrice: 90,
    priceText: "Aplicação R$ 100 | Manutenção R$ 90",
    maintenanceLabel: "Manutenção de 15 a 20 dias",
    description: "Volume marcante, textura bonita e acabamento mais preenchido.",
    durationMinutes: 120,
    featured: true,
    active: true,
    sortOrder: 30
  },
  {
    id: "volume-egipcio",
    name: "Volume Egípcio",
    image: "assets/volume-egipcio.jpg",
    applicationPrice: 110,
    maintenancePrice: 100,
    priceText: "Aplicação R$ 110 | Manutenção R$ 100",
    maintenanceLabel: "Manutenção de 15 a 20 dias",
    description: "Fios com presença e desenho sofisticado para um olhar intenso.",
    durationMinutes: 120,
    featured: false,
    active: true,
    sortOrder: 40
  },
  {
    id: "anime",
    name: "Anime",
    image: "assets/anime.jpg",
    applicationPrice: 130,
    maintenancePrice: null,
    priceText: "Aplicação R$ 130",
    maintenanceLabel: "Sem manutenção",
    description: "Pontas evidentes e estilo expressivo, com efeito mais artístico.",
    durationMinutes: 120,
    featured: false,
    active: true,
    sortOrder: 50
  },
  {
    id: "fox-gatinho",
    name: "Técnica Fox Gatinho",
    image: "assets/fox.png",
    applicationPrice: 145,
    maintenancePrice: 130,
    priceText: "Aplicação R$ 145 | Manutenção R$ 130",
    maintenanceLabel: "Manutenção R$ 130",
    description: "Alongamento com efeito gatinho, puxando o olhar com acabamento moderno.",
    durationMinutes: 120,
    featured: true,
    active: true,
    sortOrder: 60
  }
];

const DEFAULT_BUSINESS_HOURS = [
  { dayOfWeek: 0, isOpen: false, times: [] },
  { dayOfWeek: 1, isOpen: true, times: ["19:00", "21:00"] },
  { dayOfWeek: 2, isOpen: true, times: ["19:00", "21:00"] },
  { dayOfWeek: 3, isOpen: true, times: ["19:00", "21:00"] },
  { dayOfWeek: 4, isOpen: true, times: ["19:00", "21:00"] },
  { dayOfWeek: 5, isOpen: true, times: ["19:00", "21:00"] },
  { dayOfWeek: 6, isOpen: true, times: ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"] }
];

const DEFAULT_SETTINGS = {
  site: {
    brandName: "Yas Femme Studio",
    footerText: "Yas Femme Studio - Catálogo e agenda local.",
    bookingMaxDays: 60
  },
  hero: {
    eyebrow: "Studio de estética",
    title: "Yas Femme Studio",
    copy: "Design de cílios com agenda online, atendimento reservado e confirmação pelo WhatsApp."
  },
  contact: {
    whatsappNumber: "557381676132",
    instagramUrl: "https://www.instagram.com/y._femme_studio?igsh=aDF0MTdzY3ZoY2Ro",
    publicBaseUrl: "https://yasfemmestudio.sirel.com.br",
    pixKey: "(73) 98167-6132"
  },
  location: {
    line1: "Rua Clériston Andrade, 53D",
    line2: "Jardim Caraipe, Teixeira de Freitas - BA",
    reference: "Acima do Espaço Encantary.",
    mapsUrl: "https://www.google.com/maps/dir/?api=1&destination=R.%20Cl%C3%A9riston%20Andrade%2C%2053%20-%20Jardim%20Caraipe%2C%20Teixeira%20de%20Freitas%20-%20BA",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d475.529838287375!2d-39.74114660314909!3d-17.543818185339077!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x735441ba315a763%3A0x4b4fe824419be0e3!2sR.%20Cl%C3%A9riston%20Andrade%2C%2053%20-%20Jardim%20Caraipe%2C%20Teixeira%20de%20Freitas%20-%20BA%2C%2045990-740!5e0!3m2!1spt-BR!2sbr!4v1775428020751!5m2!1spt-BR!2sbr"
  },
  payments: {
    pix: true,
    cash: true,
    debit: ["Visa", "Mastercard", "Elo", "Cabal", "Banricompras"],
    credit: ["Visa", "Mastercard", "Elo", "Cabal", "Hipercard", "American Express", "Diners Club", "Hiper"],
    vouchers: ["Pluxee", "Alelo", "VR benefícios", "Ticket"]
  }
};

module.exports = {
  DEFAULT_SERVICES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SETTINGS
};
