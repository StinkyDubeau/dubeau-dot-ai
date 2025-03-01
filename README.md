# dubeau-dot-ai

This repo contains a simple server which is used by www.dubeau.org for some AI and scraping functions.

index.js currently (Febuary 2025) contains a discord scraper and an ollama instance which, combined, serve "Astro Sightings" on dubeau.org.

0. Host on debian (tested with 11 stable)
1. Install node
2. Install ollama (apt install ollama)
3. Get a model (`ollama pull nous-hermes2:13b`)
4. Install dependencies (`npm i`)
5. Define environent variables:
```
PORT=XXXX, e.g. 3000
MODEL=name of model, e.g. nous-hermes2
```

6. `npm run dev`

Extra Deployment Help:
- MongoDB: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
