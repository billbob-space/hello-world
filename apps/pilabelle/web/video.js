// Extrait l'identifiant YouTube d'un lien Shorts ou classique, pour
// construire l'URL d'integration (PRD §7.3, §11 : lecture integree, jamais
// re-telechargee).
export function idVideo(url) {
	if (!url) return null;
	const shorts = url.match(/\/shorts\/([\w-]+)/);
	if (shorts) return shorts[1];
	const watch = url.match(/[?&]v=([\w-]+)/);
	if (watch) return watch[1];
	return null;
}

export function urlIntegree(url) {
	const id = idVideo(url);
	if (!id) return null;
	return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0`;
}
