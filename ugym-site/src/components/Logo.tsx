/**
 * Marca do Gastô.
 * Os contornos foram vetorizados a partir do arquivo original da logo,
 * por isso a geometria é idêntica à identidade existente.
 */

const G_BODY =
  "M2083 5129 c-178 -27 -392 -102 -539 -188 -127 -75 -221 -150 -331 -264 -298 -309 -443 -713 -412 -1146 20 -272 117 -540 276 -763 75 -106 236 -268 340 -341 697 -495 1654 -320 2125 388 119 180 193 366 230 580 17 102 19 147 15 295 -6 191 -19 266 -72 426 -74 224 -191 410 -365 584 -213 214 -459 348 -748 411 -111 24 -414 34 -519 18z m362 -650 c218 -40 433 -184 558 -372 162 -243 186 -567 62 -833 -84 -183 -232 -332 -418 -419 -121 -58 -213 -78 -362 -78 -101 0 -148 5 -210 22 -247 66 -449 230 -563 456 -125 250 -114 558 29 812 60 105 197 244 304 306 79 46 191 89 276 106 64 13 256 13 324 0z";

const G_CUP =
  "M797 2073 c22 -386 177 -730 449 -997 285 -279 647 -426 1049 -426 410 0 759 144 1051 434 268 267 420 595 441 954 l6 112 -321 0 -321 0 -5 -57 c-23 -222 -93 -390 -221 -531 -172 -188 -384 -282 -640 -283 -235 0 -422 74 -594 237 -156 147 -242 330 -266 567 l-7 67 -312 0 -313 0 4 -77z";

const G_FLAG =
  "M3165 5128 c-132 -5 -259 -11 -283 -14 -45 -6 -48 -18 -7 -28 47 -12 210 -94 290 -146 169 -111 316 -254 426 -416 55 -81 139 -245 163 -318 9 -27 20 -54 23 -59 13 -21 21 21 17 87 -4 64 -17 426 -27 745 -5 167 2 162 -206 159 -86 -1 -264 -5 -396 -10z";

type Props = {
  size?: number;
  /** cor do corpo do "g" — o acento verde é sempre a cor da marca */
  ink?: string;
  accent?: string;
  className?: string;
};

export function LogoMark({
  size = 28,
  ink = "currentColor",
  accent = "#12FB3D",
  className,
}: Props) {
  return (
    <svg
      className={className}
      width={(size * 318) / 468}
      height={size}
      viewBox="70 56 318 468"
      role="img"
      aria-label="Gastô"
      fill="none"
    >
      <g transform="translate(0,580) scale(0.1,-0.1)">
        <path d={G_BODY} fill={ink} />
        <path d={G_CUP} fill={ink} />
        <path d={G_FLAG} fill={accent} />
      </g>
    </svg>
  );
}

export function Wordmark({
  size = 22,
  ink = "currentColor",
  accent = "#12FB3D",
}: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.34,
        color: ink,
      }}
    >
      <LogoMark size={size * 1.16} ink={ink} accent={accent} />
      <span
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 600,
          fontSize: size,
          letterSpacing: "-0.035em",
          lineHeight: 1,
        }}
      >
        Gastô
      </span>
    </span>
  );
}
