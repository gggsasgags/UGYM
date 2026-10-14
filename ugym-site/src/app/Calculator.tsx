import { useEffect, useRef } from "react";
import { Icon } from "../components/Icon";
import type { CalcTape } from "../lib/store";

const KEYS = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ",", "="],
] as const;

const fmt = (v: number) => {
  if (!Number.isFinite(v)) return "Erro";
  const r = Math.round(v * 1e10) / 1e10;
  return r.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
};

const toNumber = (shown: string) => Number(shown.replace(/\./g, "").replace(",", ".")) || 0;

const operate = (a: number, b: number, op: string) =>
  op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : op === "÷" ? a / b : b;

/** Calculadora flutuante: o estado vive no store, então ela sobrevive à troca de abas. */
export function Calculator({
  tape,
  onTape,
  onClose,
}: {
  tape: CalcTape;
  onTape: (t: CalcTape) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const press = (key: string) => {
    const { shown, acc, op, fresh, memo } = tape;

    if (key === "C") {
      onTape({ shown: "0", acc: null, op: null, fresh: true, memo: "" });
      return;
    }
    if (key === "⌫") {
      const next = fresh ? "0" : shown.slice(0, -1);
      onTape({ ...tape, shown: next.length ? next : "0", fresh: false });
      return;
    }
    if (key === "%") {
      onTape({ ...tape, shown: fmt(toNumber(shown) / 100), fresh: true });
      return;
    }
    if (key === "=") {
      if (op === null || acc === null) return;
      const value = operate(acc, toNumber(shown), op);
      onTape({
        shown: fmt(value),
        acc: null,
        op: null,
        fresh: true,
        memo: `${memo} ${shown} =`.trim(),
      });
      return;
    }
    if (["+", "−", "×", "÷"].includes(key)) {
      const current = toNumber(shown);
      const value = op !== null && acc !== null && !fresh ? operate(acc, current, op) : current;
      onTape({
        shown: fmt(value),
        acc: value,
        op: key,
        fresh: true,
        memo: `${fmt(value)} ${key}`,
      });
      return;
    }
    if (key === ",") {
      if (shown.includes(",")) return;
      onTape({ ...tape, shown: fresh ? "0," : `${shown},`, fresh: false });
      return;
    }
    // dígito
    const base = fresh || shown === "0" ? "" : shown;
    if (base.replace(/\D/g, "").length >= 12) return;
    onTape({ ...tape, shown: `${base}${key}`, fresh: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Escape") return onClose();
      const map: Record<string, string> = {
        "*": "×",
        x: "×",
        "/": "÷",
        "-": "−",
        "+": "+",
        Enter: "=",
        "=": "=",
        Backspace: "⌫",
        ".": ",",
        ",": ",",
        "%": "%",
        Escape: "C",
      };
      if (/^\d$/.test(k)) {
        e.preventDefault();
        press(k);
      } else if (map[k]) {
        e.preventDefault();
        press(map[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="calc" ref={ref} role="dialog" aria-label="Calculadora">
      <div className="calc__bar">
        <span className="calc__title">
          <Icon name="calc" size={15} />
          Calculadora
        </span>
        <button onClick={onClose} aria-label="Fechar calculadora">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="calc__out">
        <span className="calc__memo num">{tape.memo || " "}</span>
        <span className="calc__shown num">{tape.shown}</span>
      </div>

      <div className="calc__pad">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            className={`calc__k${["÷", "×", "−", "+"].includes(k) ? " calc__k--op" : ""}${
              k === "=" ? " calc__k--eq" : ""
            }${k === "C" ? " calc__k--clear" : ""}${k === "0" ? " calc__k--wide" : ""}`}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
