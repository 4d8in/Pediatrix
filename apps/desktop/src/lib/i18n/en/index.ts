import app from "./app";
import clinical from "./clinical";
import services from "./services";
import management from "./management";
import record from "./record";
import print from "./print";

// Dictionnaire français -> anglais, découpé par zone pour éviter les conflits d'édition.
export const EN: Record<string, string> = { ...app, ...clinical, ...services, ...management, ...record, ...print };
