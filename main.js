import './style.css';
import { Globe } from './src/globe.js';
import { UI } from './src/ui.js';

window.addEventListener('DOMContentLoaded', () => {
    // Callback when a city is hovered
    const onCityHover = (cityData) => {
        ui.updateInfoPanel(cityData);
    };

    const globe = new Globe('app', onCityHover);
    const ui = new UI(globe);

    // Expose for debugging
    window.globe = globe;
});
