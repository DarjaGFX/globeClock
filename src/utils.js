import * as THREE from 'three';

export function latLonToVector3(lat, lon, radius) {
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);

    // Y is Up (Latitude)
    // Lon 0 is at +Z (Facing User)
    // Lon 90 East is at +X (Right) - Counter Clockwise from Top
    const x = radius * Math.cos(latRad) * Math.sin(lonRad);
    const y = radius * Math.sin(latRad);
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);

    return new THREE.Vector3(x, y, z);
}

const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

function getJulianDate(date) {
    // date.getTime() is UTC milliseconds since 1970-01-01
    // (date.getTime() / 86400000) converts to days
    // 2440587.5 is the Julian Date for 1970-01-01 00:00:00 UTC
    return (date.getTime() / 86400000) + 2440587.5;
}

/**
 * Returns basic solar parameters:
 * { lon: Ecliptic Longitude (deg), dec: Declination (deg), ra: Right Ascension (deg), eot: Equation of Time (mins) }
 */
function getSolarParameters(date) {
    const jd = getJulianDate(date);
    const n = jd - 2451545.0; // Days since J2000

    // Mean longitude (deg)
    let L = (280.460 + 0.9856474 * n) % 360;
    if (L < 0) L += 360;

    // Mean anomaly (deg)
    let g = (357.528 + 0.9856003 * n) % 360;
    if (g < 0) g += 360;

    // Ecliptic longitude (deg)
    let lambda = L + 1.915 * Math.sin(g * deg2rad) + 0.020 * Math.sin(2 * g * deg2rad);

    // Obliquity of ecliptic (deg)
    const epsilon = 23.439 - 0.0000004 * n;

    // Right Ascension (deg)
    let alpha = Math.atan2(Math.cos(epsilon * deg2rad) * Math.sin(lambda * deg2rad), Math.cos(lambda * deg2rad)) * rad2deg;
    if (alpha < 0) alpha += 360;

    // Declination (deg)
    const delta = Math.asin(Math.sin(epsilon * deg2rad) * Math.sin(lambda * deg2rad)) * rad2deg;

    // Equation of Time (minutes)
    // alpha is in degrees, L is in degrees. (L - alpha) is in degrees.
    // 1 degree = 4 minutes of time.
    let eot = (L - alpha);
    if (eot > 180) eot -= 360;
    if (eot < -180) eot += 360;
    eot *= 4;

    return { lon: lambda, dec: delta, ra: alpha, eot: eot };
}

export function getLocalTime(timezone) {
    try {
        return new Date().toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return "00:00:00";
    }
}

export function getSunPosition() {
    const params = getSolarParameters(new Date());

    // In our coordinate system:
    // 12:00 UTC (noon) -> Sun is at Lon 0? 
    // Actually, GMT (Greenwich Mean Time) is defined by the Mean Sun.
    // True Sun position at time T (UTC):
    // Longitude of Sun relative to Earth = (12 - UTC_decimal) * 15 + Equation of Time (deg)

    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

    // Eq of Time in degrees = params.eot / 4
    const sunLon = (12 - utcHours) * 15 + (params.eot / 4);
    const sunLat = params.dec;

    return latLonToVector3(sunLat, sunLon, 100);
}

export function getMoonPosition() {
    const now = new Date();
    const jd = getJulianDate(now);
    const n = jd - 2451545.0;

    // Simplified Lunar position formulas (Low precision)
    // L: Mean longitude of moon
    let L = (218.316 + 13.176396 * n) % 360;
    // M: Mean anomaly of moon
    let M = (134.963 + 13.064993 * n) % 360;
    // F: Mean argument of latitude
    let F = (93.272 + 13.229350 * n) % 360;

    // Ecliptic longitude (lambda)
    let lambda = L + 6.289 * Math.sin(M * deg2rad);
    // Ecliptic latitude (beta)
    let beta = 5.128 * Math.sin(F * deg2rad);
    // Parallax (pi) - distance approximation
    // let pi = 0.9508 + 0.0518 * Math.cos(M * deg2rad);

    // Obliquity (epsilon)
    const epsilon = 23.439 - 0.0000004 * n;

    // Convert Ecliptic (lambda, beta) to Equatorial (alpha, delta)
    const ra = Math.atan2(Math.sin(lambda * deg2rad) * Math.cos(epsilon * deg2rad) - Math.tan(beta * deg2rad) * Math.sin(epsilon * deg2rad), Math.cos(lambda * deg2rad)) * rad2deg;
    const dec = Math.asin(Math.sin(beta * deg2rad) * Math.cos(epsilon * deg2rad) + Math.cos(beta * deg2rad) * Math.sin(epsilon * deg2rad) * Math.sin(lambda * deg2rad)) * rad2deg;

    // Right Ascension RA (alpha) is the angle from the vernal equinox.
    // To get the Longitude on Earth, we need the Greenwich Sidereal Time (GST).
    // Local Longitude = (RA - GST)

    // GST (degrees) = (100.46 + 0.985647 * n + 15 * UTC_hours) % 360
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    let gst = (100.46061837 + 0.9856473662862 * n + 15 * utcHours) % 360;
    if (gst < 0) gst += 360;

    let moonLon = ra - gst;
    // Normalize to -180, 180
    while (moonLon > 180) moonLon -= 360;
    while (moonLon < -180) moonLon += 360;

    return latLonToVector3(dec, moonLon, 40); // Radius 40
}

export function getSolarTimeStr(lon) {
    const now = new Date();
    const params = getSolarParameters(now);

    // Precise UTC time in milliseconds
    const utcTime = now.getTime();

    // Offset in milliseconds for Longitude (15 deg = 1h = 3600s = 3600000ms)
    const solarOffsetMs = (lon / 15) * 3600 * 1000;

    // Mean Solar Time (LMT)
    const meanSolarDate = new Date(utcTime + solarOffsetMs);

    // True (Apparent) Solar Time = Mean Solar Time + Equation of Time
    const trueSolarDate = new Date(meanSolarDate.getTime() + params.eot * 60 * 1000);

    // Use UTC for formatting to prevent the browser's local timezone from interfering
    return trueSolarDate.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
