/**
 * Conjunto de ícones de traço, monocromático.
 * A versão anterior do Gastô usava emojis coloridos; aqui a cor
 * fica reservada para o dado, e o ícone carrega só a forma.
 */

export type IconName = keyof typeof PATHS;

const PATHS = {
  // categorias
  carro: "M4 15v3h3v-2h10v2h3v-3M3.5 14l1.6-4.6A2 2 0 0 1 7 8h10a2 2 0 0 1 1.9 1.4L20.5 14M3.5 14h17M6.8 11.5h10.4M7 14v0M17 14v0",
  combustivel: "M4 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M3 20h11M6.5 9.5h4M16 8l2.2 2.2a1.5 1.5 0 0 1 .44 1.06V17a1.5 1.5 0 0 0 3 0v-6",
  viagem: "M10.2 20.4 12 15l4.6 1.6L18 21l1.6-.5-1.1-4.8 2.4.8a1.6 1.6 0 0 0 1-3l-2.3-.8L22 8l-1.2-1.1-4 2.8-4.6-1.6 1.8-5.4-1.6-.6-3 5.2-3.6-1.2A1.7 1.7 0 0 0 4.4 9l3.4 1.6-2.2 4.8 1.5.6 2.8-3.4",
  academia: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
  pessoal: "M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM5 20a7 7 0 0 1 14 0",
  entretenimento: "M4 9V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a2 2 0 0 0 0 6v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-6ZM10 6v12",
  restaurante: "M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16.5 3c-1.1 1-1.7 2.4-1.7 4v4.5h3.4V3M17 11.5V21",
  mercado: "M3 4h2.2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6M9.5 19.5v.01M16.5 19.5v.01",
  vestuario: "M8.5 3 5 5.2 3.5 9l2.8 1.3V21h11.4v-10.7L20.5 9 19 5.2 15.5 3a3.5 3.5 0 0 1-7 0Z",
  casa: "M4 10.5 12 4l8 6.5M6 9.8V20h12V9.8M10 20v-5h4v5",
  saude: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z",
  educacao: "M3 8.5 12 4l9 4.5-9 4.5-9-4.5ZM7 11v5.2c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V11M20.5 9v5",
  assinaturas: "M4 10a8 8 0 0 1 13.3-3.6L20 9M20 5v4h-4M20 14a8 8 0 0 1-13.3 3.6L4 15M4 19v-4h4",
  outros: "M6 12h.01M12 12h.01M18 12h.01",
  salario: "M3 7h18v10H3zM12 14.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM6.5 10v0M17.5 14v0",
  freelance: "M4 8h16v11H4zM9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M4 13h16",
  investimentos: "M4 17.5 9.5 12l3.5 3.2L20 8M15 8h5v5",

  // interface
  inicio: "M4 5.5h6v6H4zM14 5.5h6v6h-6zM4 14.5h6v6H4zM14 14.5h6v6h-6z",
  lancamentos: "M4 7h16M4 12h16M4 17h10",
  resumo: "M5 20V12M12 20V5M19 20v-5",
  analises: "M12 3.5 13.4 8 18 9.4 13.4 10.8 12 15.4 10.6 10.8 6 9.4 10.6 8ZM18.5 16l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7ZM5.5 3l.6 1.7 1.7.6-1.7.6L5.5 8l-.6-1.6-1.7-.6 1.7-.6Z",
  chevronLeft: "M14.5 6 9 12l5.5 6",
  chevronRight: "M9.5 6 15 12l-5.5 6",
  chevronDown: "M6 9.5 12 15l6-5.5",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2 21 21",
  close: "M6 6l12 12M18 6 6 18",
  arrowUpRight: "M7 17 17 7M8.5 7H17v8.5",
  arrowDownRight: "M7 7l10 10M17 8.5V17H8.5",
  check: "M5 12.5 10 17.5 19 7",
  alert: "M12 4 2.8 20h18.4ZM12 10v4.5M12 17.4v.01",
  calendar: "M4 6.5h16v14H4zM4 11h16M8.5 3.5v4M15.5 3.5v4",
  tag: "M4 11.6V4.5h7.1l8.4 8.4-7.1 7.1-8.4-8.4ZM8 8v.01",
  trash: "M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5 7.6 20h8.8l1.1-13.5M10 10v6.5M14 10v6.5",
  logout: "M14 4.5H5.5v15H14M18.5 12H10M15.5 8.5 19 12l-3.5 3.5",
  eye: "M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  // olho cortado: o mesmo desenho, com a barra que diz "escondido"
  eyeOff:
    "M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.7 3.6M6.4 6.9A17 17 0 0 0 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 4.1-.9M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6M3.5 3.5l17 17",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.8v.01",
  sheet: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  filter: "M4 6h16M7 12h10M10 18h4",
  download: "M12 4v10M8 10.5 12 14.5l4-4M5 19h14",
  upload: "M12 15V5M8 8.5 12 4.5l4 4M5 19h14",
  edit: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 6.5l3 3",
  image: "M4 5.5h16v13H4zM4 15l4.5-4 4 3.5 3-2.5L20 16M9 9.5v.01",
  up: "M12 19V6M6.5 11.5 12 6l5.5 5.5",
  down: "M12 5v13M6.5 12.5 12 18l5.5-5.5",
  wallet: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v2.5M4 7.5V18a2 2 0 0 0 2 2h13v-4M4 7.5h15V12M20.5 12h-4a2 2 0 0 0 0 4h4z",
  spark: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  calc: "M5 2.5h14v19H5zM8 5.8h8v3.4H8zM8.6 12.8h.01M12 12.8h.01M15.4 12.8h.01M8.6 16h.01M12 16h.01M15.4 16h.01M8.6 19.2h.01M12 19.2h.01M15.4 19.2h.01",
  lock: "M6.5 10.5h11v9.5h-11zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3",
  lanterna: "M9 3h6v3.5l-1.6 2.2V21h-2.8V8.7L9 6.5ZM9 6.5h6",
  camera: "M4 8.5h3.3l1.4-2h6.6l1.4 2H20v11H4zM12 17a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  signal: "M3 17.5v2M8 14v5.5M13 10v9.5M18 6v13.5",
  wifi: "M3.5 9.2a13 13 0 0 1 17 0M6.8 12.7a8.2 8.2 0 0 1 10.4 0M10.2 16.2a3.4 3.4 0 0 1 3.6 0M12 19.6v.01",
  bateria: "M3 8.5h15v7H3zM20 11v2M5 10.4h10v3.2H5z",
  mail: "M3.5 6h17v12h-17zM3.5 6.5 12 13l8.5-6.5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  shield: "M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6ZM9 12l2.2 2.2L15.2 10",
  celular: "M7 2.5h10v19H7zM10.2 19.6h3.6",
  // pasta com as duas setas: arquivo entrando e arquivo saindo
  arquivo: "M3 6.5h6l2 2.5h10v11H3zM12 17.5V12M9.8 14.2 12 12l2.2 2.2",
  // o mesmo desenho do botão de compartilhar do iPhone, que é por onde se instala
  compartilhar: "M12 3.5v11M8.6 6.9 12 3.5l3.4 3.4M6 11.5V20h12v-8.5",
} as const;

export function Icon({
  name,
  size = 20,
  stroke = 1.6,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
