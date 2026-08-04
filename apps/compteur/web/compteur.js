// Aucune dependance : servi tel quel, embarque dans le binaire par go:embed.

const valeur = document.getElementById("valeur");
const provenance = document.getElementById("provenance");
const dernier = document.getElementById("dernier");
const bouton = document.getElementById("bouton");

function afficher(d) {
  valeur.textContent = String(d.valeur);
  provenance.textContent = d.provenance === "cache" ? "Lu dans le cache" : "Lu dans la base";
  dernier.textContent = d.dernier_par ? `Dernier clic par ${d.dernier_par}` : "";
}

async function charger() {
  const res = await fetch("/api/compteur");
  afficher(await res.json());
}

bouton.addEventListener("click", async () => {
  bouton.disabled = true;
  try {
    await fetch("/api/compteur", { method: "POST" });
    // Une lecture explicite, pas la reponse brute du POST : c'est ce qui
    // rend la provenance affichee fidele a un GET reel, et pas seulement au
    // fait que l'ecriture elle-meme vient toujours de la base.
    await charger();
  } finally {
    bouton.disabled = false;
  }
});

charger();
