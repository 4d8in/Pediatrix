// Profil de l'utilisateur connecté, porté par sa ressource FHIR Practitioner :
// nom (name[0].text), téléphone et e-mail professionnels (telecom), photo
// (photo[0], image encodée en base64). Aucune donnée n'est stockée hors du LAN.

export interface FhirPractitioner {
  resourceType: "Practitioner";
  id: string;
  name?: { text?: string }[];
  telecom?: { system?: string; value?: string; use?: string }[];
  photo?: { contentType?: string; data?: string }[];
  [key: string]: unknown;
}

export interface Profile {
  displayName: string;
  phone: string | null;
  email: string | null;
  photo: { contentType: string; data: string } | null;
}

export function fromFhirPractitioner(practitioner: FhirPractitioner): Profile {
  const telecom = practitioner.telecom ?? [];
  const photo = practitioner.photo?.[0];
  return {
    displayName: practitioner.name?.[0]?.text ?? "",
    phone: telecom.find((t) => t.system === "phone")?.value ?? null,
    email: telecom.find((t) => t.system === "email")?.value ?? null,
    photo: photo?.data && photo.contentType ? { contentType: photo.contentType, data: photo.data } : null,
  };
}

// Applique le profil sur la ressource existante (le reste — identifier, active… — est conservé).
export function withProfile(practitioner: FhirPractitioner, profile: Profile): FhirPractitioner {
  const telecom = [
    ...(profile.phone ? [{ system: "phone", value: profile.phone, use: "work" }] : []),
    ...(profile.email ? [{ system: "email", value: profile.email, use: "work" }] : []),
  ];
  return {
    ...practitioner,
    name: [{ text: profile.displayName }],
    telecom: telecom.length > 0 ? telecom : undefined,
    photo: profile.photo ? [profile.photo] : undefined,
  };
}

const PHONE_RE = /^\+?[0-9 ]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO_TYPES = ["image/jpeg", "image/png"];
// Photo déjà redimensionnée par le client (256×256) : 300 Ko de base64 suffisent largement.
const MAX_PHOTO_BASE64 = 300_000;

export function validateProfile(body: unknown): { profile: Profile } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const displayName = typeof b.displayName === "string" ? b.displayName.trim() : "";
  const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim() : null;

  if (!displayName || displayName.length > 80) errors.push("Le nom affiché est requis (80 caractères maximum).");
  if (phone && !PHONE_RE.test(phone)) errors.push("Téléphone invalide (chiffres, espaces et + uniquement).");
  if (email && !EMAIL_RE.test(email)) errors.push("Adresse e-mail invalide.");

  let photo: Profile["photo"] = null;
  if (b.photo !== null && b.photo !== undefined) {
    const p = b.photo as Record<string, unknown>;
    const contentType = typeof p.contentType === "string" ? p.contentType : "";
    const data = typeof p.data === "string" ? p.data : "";
    if (!PHOTO_TYPES.includes(contentType)) {
      errors.push("La photo doit être au format JPG ou PNG.");
    } else if (!data || data.length > MAX_PHOTO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
      errors.push("Photo invalide ou trop volumineuse.");
    } else {
      photo = { contentType, data };
    }
  }

  if (errors.length > 0) return { errors };
  return { profile: { displayName, phone, email, photo } };
}
