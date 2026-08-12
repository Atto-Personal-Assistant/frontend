<h2 style="text-align: center">
    Atto
</h2>

<p>
    Objective: I'm creating a personal assistant, with a neural network. <br/>
</p>

<p>
    Started date: 19/03/2024
</p>
## Desktop macOS (MVP)

The React interface can be packaged as a transparent, borderless macOS window
through Tauri. The desktop configuration is isolated under `src-tauri` and
does not change the existing web build.

Install Rust and the Tauri prerequisites, then run:

```bash
npm install
npm run desktop:dev
```

To generate the macOS application bundle:

```bash
npm run desktop:build
```
