// Cobro con QR (nivel A): el QR fijo de la cuenta del taller se muestra con el monto y el personal
// marca "Efectivo" o "QR". Así la caja y el resumen del día separan lo que hay en el cajón de lo que entró al banco.
// Configuración en KeyValue "payments:qr" (no necesita migración).
import { readKV, writeKV } from "./automation";

export type PayMethod = "cash" | "qr";
export const PAY_METHODS: PayMethod[] = ["cash", "qr"];
export const isPayMethod = (v: unknown): v is PayMethod => v === "cash" || v === "qr";

export interface PaymentQr {
  /** Imagen del QR (subida con /api/upload → "/uploads/…") */
  image: string;
  /** Banco, ej. "Banco Unión" */
  bank: string;
  /** Titular de la cuenta (para que el cliente confirme a quién paga) */
  holder: string;
  /** Mostrar el QR también en la cotización / nota de venta impresa y en el comprobante digital */
  onDocuments: boolean;
}
const KEY = "payments:qr";
const DEFAULT: PaymentQr = { image: "", bank: "", holder: "", onDocuments: false };

export async function getPaymentQr(): Promise<PaymentQr> {
  return { ...DEFAULT, ...(await readKV<Partial<PaymentQr>>(KEY, {})) };
}

export async function savePaymentQr(input: Record<string, unknown>): Promise<PaymentQr> {
  const cur = await getPaymentQr();
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const image = str(input.image, 200);
  if (image !== undefined && image !== "" && !/^\/uploads\/[A-Za-z0-9._-]+$/.test(image)) throw new Error("Imagen inválida");
  const next: PaymentQr = {
    image: image ?? cur.image,
    bank: str(input.bank, 60) ?? cur.bank,
    holder: str(input.holder, 80) ?? cur.holder,
    onDocuments: typeof input.onDocuments === "boolean" ? input.onDocuments : cur.onDocuments,
  };
  await writeKV(KEY, next);
  return next;
}
