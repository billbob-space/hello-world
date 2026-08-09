// Envoi effectif des notifications push (PRODUIT "Notifications : rappel de
// seance et mots doux", 9 aout 2026). Isole derriere Notifieur pour qu'aucun
// test ne fasse un vrai appel reseau : main_test.go et notifications_test.go
// fournissent un mock qui implemente cette meme interface.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// ErrAbonnementExpire signale un abonnement que le navigateur ou le service de
// push a revoque (reponse HTTP 404 ou 410) : le planificateur l'efface du
// profil plutot que de reessayer indefiniment un envoi voue a l'echec.
var ErrAbonnementExpire = errors.New("abonnement push expire ou revoque")

// Notifieur envoie une notification push a un abonnement. webpushNotifieur en
// est la seule implementation reelle.
type Notifieur interface {
	Envoyer(abonnement AbonnementPush, titre, corps string) error
}

// webpushNotifieur envoie via github.com/SherClockHolmes/webpush-go, avec les
// cles VAPID lues depuis l'environnement (README.md, section "Variables
// d'environnement"). NOMS de variables uniquement — aucune valeur ne vit dans
// ce depot, l'infrastructure les injecte cote serveur.
type webpushNotifieur struct {
	clePublique, clePrivee, contact string
}

// nouveauNotifieur lit VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_CONTACT.
// Rend (nil, "") si l'une des trois manque : l'appelant (main()) logue alors
// un avertissement et desactive silencieusement l'envoi, plutot que de faire
// planter le demarrage — regle imperative "l'app demarre sans intervention".
func nouveauNotifieur() (notifieur Notifieur, clePublique string) {
	pub := os.Getenv("VAPID_PUBLIC_KEY")
	priv := os.Getenv("VAPID_PRIVATE_KEY")
	contact := os.Getenv("VAPID_CONTACT")
	if pub == "" || priv == "" || contact == "" {
		return nil, ""
	}
	return &webpushNotifieur{clePublique: pub, clePrivee: priv, contact: contact}, pub
}

// chargeNotification est le corps JSON recu par web/sw.js a la reception d'un
// evenement "push" (voir son handler).
type chargeNotification struct {
	Titre string `json:"titre"`
	Corps string `json:"corps"`
}

func (n *webpushNotifieur) Envoyer(abonnement AbonnementPush, titre, corps string) error {
	sub := &webpush.Subscription{
		Endpoint: abonnement.Endpoint,
		Keys:     webpush.Keys{P256dh: abonnement.P256dh, Auth: abonnement.Auth},
	}
	charge, err := json.Marshal(chargeNotification{Titre: titre, Corps: corps})
	if err != nil {
		return err
	}
	resp, err := webpush.SendNotification(charge, sub, &webpush.Options{
		Subscriber:      n.contact,
		VAPIDPublicKey:  n.clePublique,
		VAPIDPrivateKey: n.clePrivee,
		TTL:             60,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return ErrAbonnementExpire
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("push refuse par l'endpoint : %s", resp.Status)
	}
	return nil
}
