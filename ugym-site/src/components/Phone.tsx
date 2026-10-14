import type { ReactNode } from "react";
import { Icon } from "./Icon";
import frameSrc from "../assets/phone-frame.png";
import "./phone.css";

/* Medidas tiradas da própria moldura: a imagem tem 383x785 e a tela
   recortada começa em 15,12 com 353x761. O conteúdo é desenhado em
   393x847 pontos, a mesma proporção da tela. */
const FRAME_W = 383;
const FRAME_H = 785;
const SCREEN = { x: 15, y: 12, w: 353, h: 761, r: 52 };
export const LOGICAL_W = 393;
export const LOGICAL_H = 847;

export function Phone({
  children,
  width = 300,
  className,
  glow = false,
}: {
  children: ReactNode;
  width?: number;
  className?: string;
  glow?: boolean;
}) {
  const k = width / FRAME_W;
  const height = FRAME_H * k;
  const screenW = SCREEN.w * k;
  const screenH = SCREEN.h * k;
  const scale = screenW / LOGICAL_W;

  return (
    <div
      className={`phone${glow ? " phone--glow" : ""}${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    >
      <div
        className="phone__screen"
        style={{
          left: SCREEN.x * k,
          top: SCREEN.y * k,
          width: screenW,
          height: screenH,
          borderRadius: SCREEN.r * k,
        }}
      >
        <div
          className="phone__inner"
          style={{ width: LOGICAL_W, height: LOGICAL_H, transform: `scale(${scale})` }}
        >
          {/* A barra de status é desenhada aqui, e não pintada na moldura:
              pintada, ela encolhia junto com a imagem e a hora virava um
              borrão nos aparelhos pequenos do site. */}
          <div className="phone__bar" aria-hidden="true">
            <span className="phone__hora num">9:41</span>
            <span className="phone__sinais">
              <Icon name="signal" size={14} stroke={2.2} />
              <Icon name="wifi" size={14} stroke={2.2} />
              <Icon name="bateria" size={16} stroke={1.8} />
            </span>
          </div>

          {children}
        </div>
      </div>

      <img className="phone__frame" src={frameSrc} alt="" width={width} height={height} />
    </div>
  );
}
