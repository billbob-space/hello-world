// apps/ramure-v2/internal/api/diagnostic_test.go
package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

func routesDeTestDiagnostic(t *testing.T) http.Handler {
	t.Helper()
	ancien := Mesure
	Mesure = mesure.Neuf(nil)
	t.Cleanup(func() { Mesure = ancien })
	return Routes(dependancesDeTest())
}

// TestDiagnosticSansSessionRefuse400.
func TestDiagnosticSansSessionRefuse400(t *testing.T) {
	mux := routesDeTestDiagnostic(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/diagnostic", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("attendu 400, obtenu %d", rec.Code)
	}
}

// TestDiagnosticNeSortQueLaSessionDemandeeParHTTP : deux sessions
// distinctes, l'export de l'une n'affiche rien de l'autre.
func TestDiagnosticNeSortQueLaSessionDemandeeParHTTP(t *testing.T) {
	mux := routesDeTestDiagnostic(t)
	Mesure.Compter(mesure.Promotion, "session-1")
	Mesure.Compter(mesure.LienEcoute, "session-2")

	req := httptest.NewRequest(http.MethodGet, "/api/diagnostic", nil)
	req.Header.Set(EnTeteSession, "session-1")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d : %s", rec.Code, rec.Body)
	}
	corps := rec.Body.String()
	if strings.Contains(corps, "lien_ecoute") {
		t.Fatalf("l'export de session-1 contient un evenement de session-2 : %s", corps)
	}
	if !strings.Contains(corps, "promotion") {
		t.Fatalf("l'export de session-1 devrait contenir son propre evenement : %s", corps)
	}
}
