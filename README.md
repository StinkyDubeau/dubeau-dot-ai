# dubeau-dot-ai

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
