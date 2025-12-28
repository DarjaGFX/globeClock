import { getLocalTime, getSolarTimeStr } from './utils.js';

export class UI {
    constructor(globe) {
        this.globe = globe;
        this.searchBtn = document.getElementById('find-btn');
        this.timeInput = document.getElementById('time-input');
        this.infoPanel = document.getElementById('info-panel');

        this.cityEl = document.getElementById('info-city');
        this.timeEl = document.getElementById('info-time');
        this.metaEl = document.getElementById('info-meta');

        this.initListeners();
        this.startClockLoop();
    }

    initListeners() {
        this.searchBtn.addEventListener('click', () => {
            this.handleSearch();
        });

        this.timeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
    }

    showToast(message, duration = 4000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.getElementById('ui-layer').appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }

    handleSearch() {
        const timeVal = this.timeInput.value;
        if (!timeVal) return;

        if (!this.globe.allCities) {
            this.showToast("SYSTEM LOADING DATA... PLEASE WAIT");
            return;
        }

        const [h, m] = timeVal.split(':').map(Number);
        const targetMinutes = h * 60 + m;

        let bestMatch = null;
        let minDiff = Infinity;

        // SEARCH BY SOLAR TIME (Accurate Local Mean Time)
        // This distinguishes cities in same timezone.

        this.globe.allCities.forEach(city => {
            // Calculate Solar Minutes
            // UTC Minutes + offset
            const now = new Date();
            const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
            let solarHours = utcHours + (city.lon / 15);
            if (solarHours < 0) solarHours += 24;
            if (solarHours >= 24) solarHours -= 24;

            const solarMinutes = solarHours * 60;

            // Diff
            let diff = Math.abs(solarMinutes - targetMinutes);
            if (diff > 720) diff = 1440 - diff;

            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = city;
            }
        });

        if (bestMatch && minDiff <= 30) {
            this.updateInfoPanel(bestMatch);
            this.globe.flyTo(bestMatch.lat, bestMatch.lon);
            this.globe.addTemporaryPin(bestMatch.lat, bestMatch.lon);
            this.showToast(`FOUND: ${bestMatch.name}`);
        } else {
            // Fallback
            this.updateInfoPanel(null);

            const now = new Date();
            const currentUtcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
            const targetLocalHours = h + m / 60;

            let offset = targetLocalHours - currentUtcHours;

            if (offset < -12) offset += 24;
            if (offset > 12) offset -= 24;

            let targetLon = offset * 15;

            if (targetLon > 180) targetLon -= 360;
            if (targetLon < -180) targetLon += 360;

            this.globe.flyTo(0, targetLon);
            this.globe.addTemporaryPin(0, targetLon); // Add Pin at equator
            this.showToast(`NO CITY FOUND. SHOWING TIME ZONE AREA (approx LON ${targetLon.toFixed(0)})`);
        }
    }

    updateInfoPanel(cityData) {
        if (!cityData) {
            this.infoPanel.classList.add('hidden');
            this.currentCity = null;
            return;
        }

        this.infoPanel.classList.remove('hidden');
        this.cityEl.textContent = cityData.name;

        // Show Standard Civil Time (Time-zone based)
        // This matches the user's expected "watch" time.
        const civil = getLocalTime(cityData.timezone);
        this.timeEl.textContent = civil;
        this.metaEl.innerHTML = `<span style="color:#00ccff">${cityData.timezone}</span><br>LAT: ${cityData.lat.toFixed(2)} | LON: ${cityData.lon.toFixed(2)}`;

        this.currentCity = cityData;
    }

    startClockLoop() {
        setInterval(() => {
            if (this.currentCity) {
                const civil = getLocalTime(this.currentCity.timezone);
                this.timeEl.textContent = civil;
            }
        }, 1000);
    }
}
