# LMU Munich Anime Sightseeing Game

A browser based third person sightseeing game prototype set around LMU Munich, with an anime inspired visual style.

![Game screenshot](project/assets/lmu-game-concept-v1.png)

## Run locally

From the repository root:

```bash
cd project
python3 -m http.server 8000
```

Open <http://localhost:8000/> in your browser.

## Controls

- **WASD**: move
- **Shift**: run
- **Mouse drag**: orbit the camera
- **Mouse wheel**: zoom
- **E**: inspect a nearby sightseeing point
- **P**: photography mode
- **Space**: save a screenshot

Three.js is loaded from the jsDelivr CDN.
