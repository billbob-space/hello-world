// La couche base : Postgres dans l'annexe ardoise-base, volume ardoise-donnees.
package main

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Ligne est la donnee qui traverse base, cache et API.
type Ligne struct {
	Auteur   string    `json:"auteur"`
	Texte    string    `json:"texte"`
	EcriteLe time.Time `json:"ecrite_le"`
}

type Base struct {
	pool *pgxpool.Pool
}

// NewBase ne se connecte pas immediatement : pgxpool est paresseux, la
// premiere connexion reelle a lieu au premier appel. C'est ce qui permet a
// Migrer de reessayer sans que le demarrage de l'application en depende (R6).
func NewBase(url string) (*Base, error) {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, err
	}
	return &Base{pool: pool}, nil
}

// Migrer cree le schema, en reessayant tant que la base n'accepte pas de
// connexion. R6 du PRD : depends_on ne garantit que le DEMARRAGE du conteneur
// voisin, jamais sa disponibilite — l'application doit survivre a une base
// qui n'accepte pas encore, et meme a une base qui n'acceptera jamais.
func (b *Base) Migrer(ctx context.Context) {
	for {
		_, err := b.pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS lignes (
			id        BIGSERIAL   PRIMARY KEY,
			auteur    TEXT        NOT NULL,
			texte     TEXT        NOT NULL,
			ecrite_le TIMESTAMPTZ NOT NULL DEFAULT now()
		)`)
		if err == nil {
			log.Println("base : schema pret")
			return
		}
		log.Printf("base : pas encore prete (%v), nouvel essai dans 2s", err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func (b *Base) Ajouter(ctx context.Context, auteur, texte string) (Ligne, error) {
	var l Ligne
	err := b.pool.QueryRow(ctx,
		`INSERT INTO lignes (auteur, texte) VALUES ($1, $2) RETURNING auteur, texte, ecrite_le`,
		auteur, texte,
	).Scan(&l.Auteur, &l.Texte, &l.EcriteLe)
	return l, err
}

func (b *Base) Dernieres(ctx context.Context, n int) ([]Ligne, error) {
	rows, err := b.pool.Query(ctx,
		`SELECT auteur, texte, ecrite_le FROM lignes ORDER BY ecrite_le DESC, id DESC LIMIT $1`, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Ligne
	for rows.Next() {
		var l Ligne
		if err := rows.Scan(&l.Auteur, &l.Texte, &l.EcriteLe); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (b *Base) Close() { b.pool.Close() }
