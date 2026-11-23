"use client";
import { useRef } from "react";
import { useCountUp } from "@/frontend/lib/motion";

/** Número que sube desde 0 al aparecer y late cuando cambia (tarjetas de resumen) */
export function CountUp({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(value, ref);
  return <span ref={ref} className={`rt-num${className ? ` ${className}` : ""}`} style={style}>{value}</span>;
}
