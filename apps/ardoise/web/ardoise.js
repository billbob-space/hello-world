// Aucune dependance, aucune etape de construction : ce fichier est servi tel
// quel, embarque dans le binaire par go:embed.

const champ = document.getElementById("texte");
const compteur = document.getElementById("compteur");
const erreur = document.getElementById("erreur");
const provenance = document.getElementById("provenance");
const liste = document.getElementById("lignes");
const formulaire = document.getElementById("formulaire");

const LONGUEUR_MAX = 140;

function majCompteur() {
  const reste = LONGUEUR_MAX - champ.value.length;
  compteur.textContent = `${reste} caractere${reste === 1 ? "" : "s"} restant${reste === 1 ? "" : "s"}`;
}

function afficherProvenance(p) {
  provenance.textContent = p === "cache" ? "Lu dans le cache" : "Lu dans la base";
}

function formaterDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function afficherLignes(lignes) {
  liste.textContent = "";
  for (const l of lignes) {
    const li = document.createElement("li");

    const texte = document.createElement("span");
    texte.className = "texte";
    // textContent, jamais innerHTML : le texte vient d'un humain authentifie,
    // ce qui ne le rend pas sur pour autant.
    texte.textContent = l.texte;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${l.auteur} — ${formaterDate(l.ecrite_le)}`;

    li.append(texte, meta);
    liste.append(li);
  }
}

async function charger() {
  const res = await fetch("/api/lignes");
  const donnees = await res.json();
  afficherProvenance(donnees.provenance);
  afficherLignes(donnees.lignes || []);
}

champ.addEventListener("input", majCompteur);

formulaire.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  erreur.textContent = "";

  const res = await fetch("/api/lignes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texte: champ.value }),
  });

  if (!res.ok) {
    const donnees = await res.json().catch(() => ({}));
    erreur.textContent = donnees.erreur || "l'ecriture a echoue";
    return;
  }

  champ.value = "";
  majCompteur();
  await charger();
});

majCompteur();
charger();
