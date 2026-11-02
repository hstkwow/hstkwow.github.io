// Home: shared navigation and themes, plus the interactive Earth.
import '../core/site.js';
import { initGlobe } from './globe.js';

const globe = document.getElementById('globe');
if (globe) initGlobe(globe);
