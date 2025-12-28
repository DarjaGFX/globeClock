# 🌍 GlobeClock

**GlobeClock** is a high-fidelity, interactive 3D globe visualization designed with a "spaceship/hacker" aesthetic. It provides real-time global time tracking, astronomical accuracy, and a massive city dataset.

![GlobeClock Hero](images/globe_hero.png)

## ✨ Features

- **3D Interactive Globe**: Powered by Three.js with smooth OrbitControls.
- **Astronomical Accuracy**: 
  - Real-time Sun/Moon positioning using robust Julian Date algorithms.
  - Accurate day/night terminator with seasonal axial tilt logic.
  - Corrected Equation of Time (EoT) for solar precision.
- **Massive City Database**: Over 5,000 cities with accurate IANA timezone mapping.
- **Reverse Time Lookup**: Input a time (e.g., "15:30") to find which part of the world is currently at that hour.
- **LOD (Level of Detail)**: Dynamically scales city markers based on camera zoom and population density.
- **Spaceship Aesthetic**: Glassmorphism UI, neon accents, and custom GLSL shaders.

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript + Three.js + Vite
- **Styling**: Modern CSS (Glassmorphism, Neon glow)
- **Deployment**: Docker & Docker Compose with Traefik integration
- **Data**: IANA Timezone database + World Cities dataset

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Installation & Run

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd globeClock
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to:
   `http://localhost:8080` (or `http://globe.narsoft.ir` if configured with Traefik)

## 🎨 Aesthetic

The UI is designed to feel like a terminal on a futuristic spacecraft. It uses Cyan and Green neon accents on a deep black background, with high-contrast data overlays.

---
*Developed for production-grade cinematic visualization.*
