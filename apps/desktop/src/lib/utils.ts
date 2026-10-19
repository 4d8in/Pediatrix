export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Montant avec séparateur de milliers et devise (ex. « 5 000 XOF »).
export function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("fr-FR").format(value)} ${currency}`;
}
