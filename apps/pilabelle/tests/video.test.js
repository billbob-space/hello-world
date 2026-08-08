import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idVideo, urlIntegree } from '../web/video.js';

test('extrait un id depuis un lien shorts', () => {
	assert.equal(idVideo('https://www.youtube.com/shorts/ZKVqUCwsMPs'), 'ZKVqUCwsMPs');
});

test('extrait un id depuis un lien watch', () => {
	assert.equal(idVideo('https://www.youtube.com/watch?v=QzgRg7HTGmg'), 'QzgRg7HTGmg');
});

test('rend null pour une url vide', () => {
	assert.equal(idVideo(''), null);
	assert.equal(urlIntegree(''), null);
});

test('urlIntegree porte mute et autoplay', () => {
	const u = urlIntegree('https://www.youtube.com/shorts/ZKVqUCwsMPs');
	assert.match(u, /mute=1/);
	assert.match(u, /autoplay=1/);
});
