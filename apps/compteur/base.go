// La couche base : Postgres dans l'annexe compteur-base, volume
// compteur-donnees. Meme cablage qu'ardoise/base.go, domaine different :
// une ligne singleton plutot qu'une collection.
package main

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Compteur struct {
	Valeur     int64     `json:"valeur"`
	DernierPar string    `json:"dernier_par"`
	MajLe      time.Time `json:"maj_le"`
}

type Base struct {
	pool *pgxpool.Pool
}

func NewBase(url string) (*Base, error) {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, err
	}
	return &Base{pool: pool}, nil
}

// Migrer cree le schema et la ligne singleton, en reessayant tant que la base
// n'accepte pas de connexion (R4 du PRD : depends_on ne garantit que le
// demarrage du voisin, jamais sa disponibilite).
func (b *Base) Migrer(ctx context.Context) {
	for {
		_, err := b.pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS compteur (
				id          SMALLINT    PRIMARY KEY DEFAULT 1,
				valeur      BIGINT      NOT NULL DEFAULT 0,
				dernier_par TEXT        NOT NULL DEFAULT '',
				maj_le      TIMESTAMPTZ NOT NULL DEFAULT now(),
				CONSTRAINT une_seule_ligne CHECK (id = 1)
			);
			INSERT INTO compteur (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
		`)
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

func (b *Base) Lire(ctx context.Context) (Compteur, error) {
	var c Compteur
	err := b.pool.QueryRow(ctx,
		`SELECT valeur, dernier_par, maj_le FROM compteur WHERE id = 1`,
	).Scan(&c.Valeur, &c.DernierPar, &c.MajLe)
	return c, err
}

// Incrementer est atomique : la concurrence de deux clics simultanes est
// reglee par Postgres (UPDATE ... RETURNING), pas par l'application.
func (b *Base) Incrementer(ctx context.Context, auteur string) (Compteur, error) {
	var c Compteur
	err := b.pool.QueryRow(ctx,
		`UPDATE compteur SET valeur = valeur + 1, dernier_par = $1, maj_le = now()
		 WHERE id = 1 RETURNING valeur, dernier_par, maj_le`,
		auteur,
	).Scan(&c.Valeur, &c.DernierPar, &c.MajLe)
	return c, err
}

func (b *Base) Close() { b.pool.Close() }
