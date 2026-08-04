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
    const res = await fetch("/api/compteur", { method: "POST" });
    afficher(await res.json());
  } finally {
    bouton.disabled = false;
  }
});

charger();
