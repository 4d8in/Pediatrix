import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Camera, CheckCircle2, Trash2 } from "lucide-react";
import { ApiError, getMyProfile, updateMyProfile } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Role, UserProfile } from "../lib/types";

const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};

const PHOTO_SIZE = 256;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Recadre au centre et réduit l'image à 256×256 (JPEG) avant l'envoi : la photo
// reste légère pour le réseau local et pour la ressource FHIR Practitioner.
function resizePhoto(file: File): Promise<{ contentType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;
      canvas
        .getContext("2d")
        ?.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ contentType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible."));
    };
    image.src = url;
  });
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function photoSrc(photo: UserProfile["photo"]): string | undefined {
  return photo ? `data:${photo.contentType};base64,${photo.data}` : undefined;
}

const inputClass = "w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1A6FD4]";

// Page « Mon profil » : nom affiché, téléphone, e-mail et photo de l'utilisateur connecté.
export default function Profile({ onSaved }: { onSaved: (profile: UserProfile) => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch((err) => setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Serveur injoignable." }));
  }, []);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setMessage({ ok: false, text: "Choisissez une image JPG ou PNG." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ ok: false, text: "Image trop lourde (2 Mo maximum)." });
      return;
    }
    try {
      setProfile({ ...profile, photo: await resizePhoto(file) });
      setMessage(null);
    } catch {
      setMessage({ ok: false, text: "Impossible de lire cette image." });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const saved = await updateMyProfile(profile);
      setProfile(saved);
      onSaved(saved);
      setMessage({ ok: true, text: "Profil enregistré." });
    } catch (err) {
      const text = err instanceof ApiError ? (err.details ?? [err.message]).join(" ") : "Serveur injoignable.";
      setMessage({ ok: false, text });
    } finally {
      setIsSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Mon profil</h1>
        <p className="mt-1 text-sm text-zinc-500">Vos informations et votre photo, visibles par vos collègues</p>
      </div>

      {message && (
        <p
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.ok && <CheckCircle2 className="h-4 w-4" />} {message.text}
        </p>
      )}

      {profile && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
          <section className="flex flex-col items-center gap-4 rounded-[18px] border border-zinc-200/70 bg-white p-6">
            <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-[#1A6FD4]/10 text-4xl font-medium text-[#1A6FD4]">
              {profile.photo ? (
                <img src={photoSrc(profile.photo)} alt="Photo de profil" className="h-full w-full object-cover" />
              ) : (
                initialsOf(profile.displayName)
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" onChange={handlePhoto} className="hidden" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
              >
                <Camera className="h-4 w-4" /> Changer la photo
              </button>
              {profile.photo && (
                <button
                  type="button"
                  aria-label="Retirer la photo"
                  onClick={() => setProfile({ ...profile, photo: null })}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-500 transition hover:border-red-200 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-center text-xs text-zinc-400">JPG ou PNG, 2 Mo maximum. Recadrée automatiquement.</p>
          </section>

          <section className="space-y-4 rounded-[18px] border border-zinc-200/70 bg-white p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm text-zinc-600">
                Nom affiché
                <input
                  required
                  maxLength={80}
                  value={profile.displayName}
                  onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 text-sm text-zinc-600">
                Rôle
                <input disabled value={ROLE_LABELS[user.role]} className={`${inputClass} bg-zinc-50 text-zinc-500`} />
              </label>
              <label className="space-y-1.5 text-sm text-zinc-600">
                Téléphone professionnel
                <input
                  type="tel"
                  placeholder="+221 77 000 00 00"
                  value={profile.phone ?? ""}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value || null })}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 text-sm text-zinc-600">
                E-mail professionnel
                <input
                  type="email"
                  placeholder="prenom.nom@hopital.sn"
                  value={profile.email ?? ""}
                  onChange={(event) => setProfile({ ...profile, email: event.target.value || null })}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-400">
              L'identifiant de connexion et le rôle ne sont modifiables que par l'administrateur technique.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1A6FD4] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-50"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </section>
        </form>
      )}
    </div>
  );
}
