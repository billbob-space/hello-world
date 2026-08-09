"use strict";

// estran — appelle les deux endpoints internes et rend la page. Aucune
// logique de calcul de marée ou de meteo ici : le serveur est la seule
// source de verite (domaine.go), ce fichier ne fait que mettre en forme ce
// qu'il renvoie et faire tourner l'horloge et le compte a rebours entre deux
// rafraichissements.

const RAFRAICHISSEMENT_MS = 5 * 60 * 1000;

const ICONES = {
  soleil: '<circle cx="12" cy="12" r="4.2"/><g stroke-linecap="round"><path d="M12 2.5v3"/><path d="M12 18.5v3"/><path d="M2.5 12h3"/><path d="M18.5 12h3"/><path d="M5.1 5.1l2.1 2.1"/><path d="M16.8 16.8l2.1 2.1"/><path d="M5.1 18.9l2.1-2.1"/><path d="M16.8 7.2l2.1-2.1"/></g>',
  "soleil-voile": '<circle cx="10.5" cy="10" r="4"/><g stroke-linecap="round"><path d="M10.5 2.8v2.4"/><path d="M3.3 10h2.4"/><path d="M5.6 4.9l1.7 1.7"/><path d="M15.4 4.9l-1.7 1.7"/></g><path d="M6 18.5a4 4 0 0 1 .6-7.9 5 5 0 0 1 9.7 1.1 3.6 3.6 0 0 1-.8 6.8H6Z"/>',
  "nuage-soleil": '<circle cx="9" cy="9" r="3.4"/><g stroke-linecap="round"><path d="M9 2.8v2"/><path d="M2.8 9h2"/><path d="M4.8 4.8l1.4 1.4"/><path d="M13.2 4.8l-1.4 1.4"/></g><path d="M7.5 19.2a4.2 4.2 0 0 1 .5-8.3 5.3 5.3 0 0 1 10.2 1.2 3.8 3.8 0 0 1-.8 7.1H7.5Z"/>',
  nuage: '<path d="M6.5 18.5a4.3 4.3 0 0 1 .5-8.5 5.4 5.4 0 0 1 10.4 1.2 3.9 3.9 0 0 1-.8 7.3H6.5Z"/>',
  brouillard: '<g stroke-linecap="round"><path d="M4 8.5h16"/><path d="M2.5 12.5h19"/><path d="M4 16.5h16"/><path d="M7 20.5h10"/></g>',
  "pluie-fine": '<path d="M6.5 13.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 6.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M9 17.5l-1 2.4"/><path d="M13 17.5l-1 2.4"/></g>',
  pluie: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M7.8 16.5l-1.3 3"/><path d="M12 16.5l-1.3 3"/><path d="M16.2 16.5l-1.3 3"/></g>',
  neige: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M9 17v4"/><path d="M7 18.4l4 3.2"/><path d="M11 18.4l-4 3.2"/></g>',
  orage: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><path stroke-linejoin="round" d="M12.5 15l-3 4.5h2.6L11 23l4-5.4h-2.6l1.3-2.6Z"/>',
  vent: '<g stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9h11.7a2.6 2.6 0 1 0-2.4-3.6"/><path d="M2.5 15h14.9a2.6 2.6 0 1 1-2.4 3.6"/></g>',
  vague: '<path stroke-linecap="round" d="M2 12.5c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 3.2 1.6 4.8 0M2 17.5c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 3.2 1.6 4.8 0"/>',
  goutte: '<path stroke-linejoin="round" d="M12 2.5s6 7.2 6 11.3a6 6 0 1 1-12 0c0-4.1 6-11.3 6-11.3Z"/>',
  fleche_haut: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M6 11l6-6 6 6"/>',
  fleche_bas: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M18 13l-6 6-6-6"/>',
};

// esc echappe une chaine avant insertion dans un gabarit HTML. Necessaire
// pour tout champ qui transite depuis un fournisseur externe sans passer par
// un vocabulaire ferme cote serveur — notamment m.precedent.type et
// m.prochain.type, qui viennent tels quels du JSON d'api-maree.fr.
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function icone(cle, classe) {
  const contenu = ICONES[cle] || ICONES.nuage;
  return `<svg class="${classe || "icone"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${contenu}</svg>`;
}

function horlogeLocale() {
  const el = document.getElementById("horloge");
  function tick() {
    const maintenant = new Date();
    el.textContent = maintenant.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  tick();
  setInterval(tick, 30 * 1000);
}

async function chargerJSON(url) {
  const reponse = await fetch(url, { headers: { accept: "application/json" } });
  if (!reponse.ok) throw new Error(`${url} : statut ${reponse.status}`);
  return reponse.json();
}

function rendrePrevisions(donnees) {
  const rangee = document.getElementById("heures-rangee");
  const source = document.getElementById("pied-source");

  if (donnees.erreur) {
    rangee.innerHTML = `<p class="etat-attente">${esc(donnees.erreur)}</p>`;
  } else {
    rangee.innerHTML = (donnees.heures || [])
      .map((h) => {
        const vagues =
          h.vagues_m != null
            ? `<span class="detail">${icone("vague")}${h.vagues_m.toFixed(1)} m</span>`
            : "";
        return `
        <div class="heure-carte">
          <span class="heure">${esc(h.heure)}</span>
          ${icone(h.symbole, "icone")}
          <span class="temperature">${Math.round(h.temperature_c)}°</span>
          <span class="detail">${icone("goutte")}${h.pluie_pct}%</span>
          <span class="detail">${icone("vent")}${h.vent_kmh} km/h</span>
          ${vagues}
        </div>`;
      })
      .join("");

    rendreTendance(donnees.jours || []);
  }

  if (source) {
    source.textContent = donnees.frais === false
      ? "Open-Meteo · api-maree.fr — dernière donnée connue, fournisseur indisponible"
      : "Open-Meteo · api-maree.fr";
  }
}

function rendreTendance(jours) {
  const rangee = document.getElementById("jours-rangee");
  if (!jours.length) {
    rangee.innerHTML = `<p class="etat-attente">tendance indisponible</p>`;
    return;
  }
  rangee.innerHTML = jours
    .map(
      (j) => `
      <div class="jour-ligne">
        <span class="jour-nom">${esc(j.jour_semaine)}</span>
        ${icone(j.symbole, "icone")}
        <span class="pluie">${icone("goutte")}${j.pluie_pct_max}%</span>
        <span class="temps"><span class="max">${Math.round(j.temp_max_c)}°</span> <span class="min">${Math.round(j.temp_min_c)}°</span></span>
      </div>`
    )
    .join("");
}

let prochaineBasculeISO = null;
let prochaineBasculeType = null;

function rendreJauge(m) {
  const carte = document.getElementById("jauge-carte");

  if (!m.configure) {
    carte.innerHTML = `
      <div class="jauge-non-configuree">
        <strong>Configuration requise</strong>
        La clé api-maree.fr (variable API_MAREE_KEY) n'est pas encore posée
        côté serveur — la jauge de marée s'activera dès qu'elle le sera.
      </div>`;
    prochaineBasculeISO = null;
    return;
  }

  if (m.erreur) {
    carte.innerHTML = `<div class="jauge-non-configuree"><strong>Marée indisponible</strong>${esc(m.erreur)}</div>`;
    prochaineBasculeISO = null;
    return;
  }

  const sensIcone = m.sens === "montante" ? "fleche_haut" : "fleche_bas";
  const sensTexte = m.sens === "montante" ? "Montante" : "Descendante";
  prochaineBasculeISO = m.prochain ? new Date(m.frais === false ? m.prochain.heure : m.prochain.heure) : null;
  // prochain.heure est "HH:MM" (heure locale du jour concerné) ; on recompose
  // une date complete a partir d'aujourd'hui pour le compte a rebours cote
  // client — si l'heure calculee est deja passee de plus de 30 min, elle
  // tombe demain (cycle qui chevauche minuit).
  prochaineBasculeISO = combinerAujourdhui(m.prochain && m.prochain.heure);
  prochaineBasculeType = m.prochain && m.prochain.type;

  carte.innerHTML = `
    <div class="jauge-entete">
      <div class="jauge-hauteur">${m.hauteur_m != null ? m.hauteur_m.toFixed(2) : "—"}<small>m</small></div>
      <div class="jauge-sens">${icone(sensIcone)}${sensTexte}</div>
    </div>
    <div class="jauge-piste">
      <div class="jauge-remplissage" style="transform: scaleX(${(m.position_pct || 0) / 100})"></div>
      <div class="jauge-marqueur" style="left: ${m.position_pct || 0}%"></div>
    </div>
    <div class="jauge-reperes">
      <div class="jauge-repere">
        ${m.precedent ? esc(m.precedent.type) + " " + esc(m.precedent.heure) : ""}
        <strong>${m.precedent ? m.precedent.hauteur_m.toFixed(2) + " m" : "—"}</strong>
      </div>
      <div class="jauge-repere a-droite">
        ${m.prochain ? esc(m.prochain.type) + " " + esc(m.prochain.heure) : ""}
        <strong>${m.prochain ? m.prochain.hauteur_m.toFixed(2) + " m" : "—"}</strong>
      </div>
    </div>
    <p class="jauge-prochaine" id="jauge-compte-a-rebours"></p>
    ${m.frais === false ? '<p class="jauge-perimee">dernière donnée connue, fournisseur indisponible</p>' : ""}
  `;

  majCompteARebours();
}

function combinerAujourdhui(heureHHMM) {
  if (!heureHHMM) return null;
  const [h, m] = heureHHMM.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Si l'heure ainsi construite est deja loin dans le passe (> 6h), la
  // bascule concerne le cycle du lendemain.
  if (d.getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function majCompteARebours() {
  const el = document.getElementById("jauge-compte-a-rebours");
  if (!el || !prochaineBasculeISO) return;

  const restant = prochaineBasculeISO.getTime() - Date.now();
  if (restant <= 0) {
    el.innerHTML = `Bascule imminente`;
    return;
  }
  const heures = Math.floor(restant / 3600000);
  const minutes = Math.round((restant % 3600000) / 60000);
  const cible = prochaineBasculeType === "PM" ? "pleine mer" : "basse mer";
  const duree = heures > 0 ? `${heures} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
  el.innerHTML = `<strong>${cible}</strong> dans ${duree}`;
}

async function tout() {
  try {
    rendrePrevisions(await chargerJSON("/api/previsions"));
  } catch (e) {
    document.getElementById("heures-rangee").innerHTML = `<p class="etat-attente">prévisions indisponibles</p>`;
    document.getElementById("jours-rangee").innerHTML = `<p class="etat-attente">tendance indisponible</p>`;
  }
  try {
    rendreJauge(await chargerJSON("/api/maree"));
  } catch (e) {
    document.getElementById("jauge-carte").innerHTML = `<p class="etat-attente">marée indisponible</p>`;
  }
}

horlogeLocale();
tout();
setInterval(tout, RAFRAICHISSEMENT_MS);
setInterval(majCompteARebours, 30 * 1000);
