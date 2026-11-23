-- Enlace público configurable (WhatsApp y códigos QR)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "publicUrl" TEXT;
