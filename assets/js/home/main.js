// Homepage: shared chrome plus the live pansharpening figure.
import '../core/site.js';
import { initSensor } from './sensor.js';

const sensor = document.getElementById('sensor');
if (sensor) initSensor(sensor);
