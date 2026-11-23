"use client";
import { useEffect, useState } from "react";
import { mouseOnly } from "@/frontend/lib/a11y";
import { CircleCheck, Star, TriangleAlert } from "@/frontend/components/icons";
import { STROKE } from "@/frontend/components/UiIcons";

interface Props {
  repairCode: string;
  repairId?: string;
  clientName?: string | null;
  /** Pase del cliente verificado (x-track-token) */
  trackToken?: string | null;
}

export function ReviewForm({ repairCode, repairId, clientName, trackToken }: Props) {
  const [existingReview, setExistingReview] = useState<{ rating: number; comment: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [google, setGoogle] = useState<string | null>(null);

  useEffect(() => {
    fetch(repairId ? `/api/reviews?repairId=${encodeURIComponent(repairId)}` : `/api/reviews?repairCode=${encodeURIComponent(repairCode)}`)
      .then(r => r.json())
      .then(d => { if (d.review) setExistingReview(d.review); if (d.google) setGoogle(d.google); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repairCode, repairId]);

  const submit = async () => {
    if (rating < 1) { setError("Selecciona una calificación"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(trackToken ? { "x-track-token": trackToken } : {}) },
        body: JSON.stringify({ repairCode, repairId, rating, comment: comment.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) { setSuccess(true); setExistingReview(data.review); }
      else { setError(data.error || "Error al guardar"); }
    } catch { setError("Error de red"); }
    setSubmitting(false);
  };

  if (loading) return null;

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "var(--shadow-card)",
    padding: "24px 22px",
    textAlign: "center",
  };

  if (existingReview) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(16,185,129,0.12)", border: "1.5px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}><Star size={24} strokeWidth={1.75} color="#b45309" aria-hidden="true" /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ok)", marginBottom: 12 }}>¡Gracias por tu reseña!</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 12 }}>
          {[1,2,3,4,5].map(n => (
            <span key={n} style={{ fontSize: 26, color: n <= existingReview.rating ? "var(--warn-bright)" : "var(--border-soft)" }}>★</span>
          ))}
        </div>
        {existingReview.comment && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", maxWidth: 360, margin: "0 auto", padding: "10px 14px", background: "#f5f7fc", borderRadius: 10, border: "1px solid var(--border-soft)" }}>
            &ldquo;{existingReview.comment}&rdquo;
          </div>
        )}
      </div>
      {google && <GoogleReviewCard href={google} />}
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 44, marginBottom: 12 }}><CircleCheck size={44} strokeWidth={1.5} aria-hidden="true" /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ok)", marginBottom: 6 }}>¡Gracias por tu opinión!</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Tu reseña fue registrada con éxito</div>
      </div>
      {google && <GoogleReviewCard href={google} />}
      </div>
    );
  }

  const ratingLabel = rating === 5 ? "¡Excelente!" : rating === 4 ? "Muy bien" : rating === 3 ? "Bien" : rating === 2 ? "Regular" : rating === 1 ? "Mejorable" : "";
  const ratingColor = rating >= 4 ? "#047857" : rating === 3 ? "#f59e0b" : rating > 0 ? "#dc2626" : "#94a3b8";

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(251,191,36,0.15)", border: "1.5px solid rgba(251,191,36,0.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 12px" }}><Star size={24} strokeWidth={1.75} color="#b45309" aria-hidden="true" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {clientName ? `${clientName}, ¿cómo calificas nuestro servicio?` : "¿Cómo calificas nuestro servicio?"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tu opinión nos ayuda a mejorar</div>
      </div>

      {/* Stars */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 10 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onPointerEnter={mouseOnly(() => setHoverRating(n))}
            onPointerLeave={mouseOnly(() => setHoverRating(0))}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 38, padding: "2px 4px", transition: "transform 0.12s",
              color: n <= (hoverRating || rating) ? "var(--warn-bright)" : "#dde6f5",
              transform: n <= hoverRating ? "scale(1.15)" : "scale(1)",
              filter: n <= (hoverRating || rating) ? "drop-shadow(0 2px 6px rgba(251,191,36,0.4))" : "none",
            }}
            aria-label={`${n} estrellas`}
          >★</button>
        ))}
      </div>

      {/* Rating label */}
      {rating > 0 && (
        <div style={{ fontSize: 12, fontWeight: 700, color: ratingColor, marginBottom: 14, height: 18 }}>
          {ratingLabel}
        </div>
      )}
      {rating === 0 && <div style={{ height: 18, marginBottom: 14 }} />}

      {/* Textarea */}
      <textarea aria-label="Tu comentario"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comparte tu experiencia (opcional)..."
        rows={3}
        maxLength={500}
        style={{
          width: "100%", padding: "12px 14px",
          background: "#f5f7fc",
          border: "1.5px solid var(--border-soft)",
          borderRadius: 12, color: "var(--text-primary)",
          fontSize: 13, resize: "vertical",
          fontFamily: "inherit", outline: "none",
          marginBottom: 14, boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
      />

      {error && <div style={{ fontSize: 12, color: "var(--danger-bright)", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><TriangleAlert size={14} strokeWidth={STROKE} aria-hidden="true" /> {error}</div>}

      <button
        onClick={submit}
        disabled={submitting || rating < 1}
        style={{
          width: "100%", padding: "13px 20px",
          background: rating > 0
            ? "linear-gradient(135deg,var(--accent-dim),var(--accent))"
            : "var(--bg-primary)",
          border: "none", borderRadius: 14,
          color: rating > 0 ? "#ffffff" : "var(--text-faint)",
          fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : (rating > 0 ? "pointer" : "not-allowed"),
          opacity: submitting ? 0.7 : 1,
          letterSpacing: "0.3px",
          boxShadow: rating > 0 ? "0 4px 16px rgba(var(--accent-bright-rgb), 0.30)" : "none",
          transitionProperty: "var(--tr-ui)", transitionDuration: "0.2s",
        }}
      >
        {submitting ? "Enviando..." : "Enviar Reseña"}
      </button>
    </div>
  );
}

/** Se muestra a todos los clientes después de calificar, sin importar las estrellas (regla de Google). */
function GoogleReviewCard({ href }: { href: string }) {
  return (
    <div style={{ background: "#f5f8ff", borderRadius: 20, border: "1px solid #c7d7fb", boxShadow: "var(--shadow-card)", padding: "22px 20px", textAlign: "center" }}>
      <div aria-hidden style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", border: "1px solid #dbe3f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 24, fontWeight: 700, fontFamily: "Arial, sans-serif" }}>
        <span style={{ color: "#4285f4" }}>G</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>¿Nos ayudas en Google?</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>Tu reseña ayuda a otras personas a encontrarnos.</div>
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", padding: "13px 16px", borderRadius: 12, background: "#4285f4", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
        <Star size={16} strokeWidth={1.75} aria-hidden="true" /> Dejar reseña en Google
      </a>
    </div>
  );
}
