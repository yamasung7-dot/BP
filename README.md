# BP — Blockbench Plugin

**PBR Material Generator** for Blockbench.

Select a texture, open **Tools → Generate PBR Material**, choose a material preset, adjust the material controls, and generate PBR maps with one click.

## Features

- Material presets: Metal, Wood, Dirt, Stone, Plastic, Fabric, Glass, Custom
- Metallic control
- Shininess control
- Normal-strength control
- Surface-detail control
- Generates Normal, Height, and MER maps
- Generated maps are added as editable Blockbench textures
- No external libraries or network access required

## Plugin structure

```text
pbr_material_generator/
  pbr_material_generator.js
  about.md
```

## Installation for testing

In Blockbench, use its plugin loading/development workflow to load `pbr_material_generator/pbr_material_generator.js`.

After loading, select a texture and use **Tools → Generate PBR Material**.

## MER format

The generated packed MER texture uses:

- Red = Metallic
- Green = Emissive
- Blue = Roughness

The prototype keeps emissive at zero unless future controls are added.

## License

MIT

## CI

Automated syntax and smoke tests run with GitHub Actions.
