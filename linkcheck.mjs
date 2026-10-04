#!/usr/bin/env node
/**
 * linkcheck — bewaakt dat geen enkele verwijzing op de site naar niets wijst.
 *
 * Aanroep:  node linkcheck.mjs
 *
 * Drie soorten fouten, alle drie stonden er eerder echt:
 *   1. href="#"           een link die niets doet (stond vier keer op de site)
 *   2. een bestand dat niet bestaat
 *   3. een #anker dat op de doelpagina niet voorkomt
 *
 * Mailtemplates (met {{ }}-plaatshouders van Supabase) worden overgeslagen: dat is geen
 * website-pagina en die plaatshouders worden pas bij het versturen vervangen.
 *
 * Nul afhankelijkheden, zodat dit zonder node_modules draait.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
const paginas = readdirSync(root).filter((f) => f.endsWith(".html"));
const inhoud = new Map(paginas.map((p) => [p, readFileSync(join(root, p), "utf8")]));

/** Alle id="..."-waarden op een pagina. */
function ankers(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

let fouten = 0;
let geteld = 0;

for (const [pagina, html] of inhoud) {
  const eigen = ankers(html);
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    const href = m[1];
    if (href.includes("{{")) continue; // mailtemplate-plaatshouder
    geteld++;

    if (href === "#" || href === "") {
      console.log(`FOUT  ${pagina}: dode link href="${href}"`);
      fouten++;
      continue;
    }
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;

    const [bestand, anker] = href.split("#");
    if (bestand) {
      if (!existsSync(join(root, bestand))) {
        console.log(`FOUT  ${pagina}: verwijst naar ${bestand}, dat bestaat niet`);
        fouten++;
        continue;
      }
      if (anker && !ankers(inhoud.get(bestand) ?? "").has(anker)) {
        console.log(`FOUT  ${pagina}: ${bestand}#${anker} bestaat niet op die pagina`);
        fouten++;
      }
    } else if (anker && !eigen.has(anker)) {
      console.log(`FOUT  ${pagina}: #${anker} bestaat niet op deze pagina`);
      fouten++;
    }
  }
}

console.log(
  `linkcheck: ${paginas.length} pagina's, ${geteld} verwijzingen — ` +
    (fouten === 0 ? "alles werkt" : fouten + " fout(en)"),
);
process.exit(fouten === 0 ? 0 : 1);
