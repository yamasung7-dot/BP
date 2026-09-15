/*
 * PBR Material Generator for Blockbench
 * Generates and connects a PBR material group from the selected texture.
 * MER: R = Metallic, G = Emissive, B = Roughness.
 */

let pbr_action;
let pbr_dialog;

const PRESETS = {
    custom: {metallic: 0, shininess: 45, normal_strength: 55, detail: 50},
    metal: {metallic: 95, shininess: 82, normal_strength: 45, detail: 35},
    wood: {metallic: 0, shininess: 28, normal_strength: 70, detail: 78},
    dirt: {metallic: 0, shininess: 8, normal_strength: 85, detail: 90},
    stone: {metallic: 0, shininess: 18, normal_strength: 72, detail: 65},
    plastic: {metallic: 0, shininess: 68, normal_strength: 30, detail: 25},
    fabric: {metallic: 0, shininess: 12, normal_strength: 62, detail: 82},
    glass: {metallic: 0, shininess: 94, normal_strength: 18, detail: 15}
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function luminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function createMapCanvas(sourceCanvas, kind, settings) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const outCtx = output.getContext('2d', {willReadFrequently: true});
    const srcCtx = sourceCanvas.getContext('2d', {willReadFrequently: true});
    const source = srcCtx.getImageData(0, 0, width, height);
    const data = source.data;
    const result = outCtx.createImageData(width, height);
    const out = result.data;
    const detail = settings.detail / 100;
    const normalStrength = settings.normal_strength / 100;
    const metallic = Math.round(settings.metallic * 2.55);
    const roughness = Math.round((100 - settings.shininess) * 2.55);

    function sample(x, y) {
        x = clamp(x, 0, width - 1);
        y = clamp(y, 0, height - 1);
        const i = (y * width + x) * 4;
        return luminance(data[i], data[i + 1], data[i + 2]);
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const h = sample(x, y);
            const left = sample(x - 1, y);
            const right = sample(x + 1, y);
            const up = sample(x, y - 1);
            const down = sample(x, y + 1);
            const dx = (right - left) * normalStrength;
            const dy = (down - up) * normalStrength;

            if (kind === 'normal') {
                out[i] = clamp(128 - dx * 127, 0, 255);
                out[i + 1] = clamp(128 - dy * 127, 0, 255);
                out[i + 2] = clamp(255 - (Math.abs(dx) + Math.abs(dy)) * 80, 80, 255);
                out[i + 3] = data[i + 3];
            } else if (kind === 'height') {
                const enhanced = clamp((h - 0.5) * (0.7 + detail * 1.3) + 0.5, 0, 1);
                const v = Math.round(enhanced * 255);
                out[i] = v;
                out[i + 1] = v;
                out[i + 2] = v;
                out[i + 3] = data[i + 3];
            } else {
                const localRoughness = clamp(roughness + (h - 0.5) * 35 * detail, 0, 255);
                out[i] = metallic;
                out[i + 1] = 0;
                out[i + 2] = Math.round(localRoughness);
                out[i + 3] = 255;
            }
        }
    }

    outCtx.putImageData(result, 0, 0);
    return output;
}

function addGeneratedTexture(name, canvas, pbrChannel) {
    const texture = new Texture({
        name,
        internal: true,
        source: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
        pbr_channel: pbrChannel
    });
    texture.add(false, true);
    return texture;
}

function createOrGetPBRMaterialGroup(sourceTexture, createdTextures) {
    let group = typeof sourceTexture.getGroup === 'function' ? sourceTexture.getGroup() : null;

    if (!group || !group.is_material) {
        if (typeof TextureGroup === 'undefined') {
            throw new Error('This Blockbench version does not provide PBR material groups. Please update Blockbench.');
        }
        group = new TextureGroup({
            name: sourceTexture.name.replace(/\.[^/.]+$/, '') + ' PBR Material',
            is_material: true
        });
    }

    sourceTexture.pbr_channel = 'color';
    sourceTexture.group = group.uuid;
    for (const texture of createdTextures) texture.group = group.uuid;

    if (!TextureGroup.all.includes(group)) group.add();
    group.updateMaterial();
    return group;
}

function generatePBR(sourceTexture, settings) {
    const sourceCanvas = sourceTexture.canvas;
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
        throw new Error('The selected texture does not have usable image data.');
    }

    const baseName = sourceTexture.name.replace(/\.[^/.]+$/, '');
    const created = [
        addGeneratedTexture(baseName + '_normal', createMapCanvas(sourceCanvas, 'normal', settings), 'normal'),
        addGeneratedTexture(baseName + '_height', createMapCanvas(sourceCanvas, 'height', settings), 'height'),
        addGeneratedTexture(baseName + '_mer', createMapCanvas(sourceCanvas, 'mer', settings), 'mer')
    ];

    return {textures: created, materialGroup: createOrGetPBRMaterialGroup(sourceTexture, created)};
}

function openPBRDialog() {
    const source = Texture.selected;
    if (!source) return Blockbench.showQuickMessage('Select a texture first.');
    if (!source.canvas || !source.canvas.width) return Blockbench.showQuickMessage('The selected texture has not finished loading.');

    pbr_dialog = new Dialog({
        id: 'pbr_material_generator_dialog',
        title: 'Generate PBR Material',
        icon: 'texture',
        width: 480,
        form: {
            preset: {
                label: 'Material', type: 'select',
                options: {custom: 'Custom', metal: 'Metal', wood: 'Wood', dirt: 'Dirt', stone: 'Stone', plastic: 'Plastic', fabric: 'Fabric', glass: 'Glass'},
                value: 'custom'
            },
            metallic: {label: 'Metallic', type: 'number', min: 0, max: 100, step: 1, value: 0},
            shininess: {label: 'Shininess', type: 'number', min: 0, max: 100, step: 1, value: 45},
            normal_strength: {label: 'Normal Strength', type: 'number', min: 0, max: 100, step: 1, value: 55},
            detail: {label: 'Surface Detail', type: 'number', min: 0, max: 100, step: 1, value: 50}
        },
        buttons: ['Generate PBR', 'Cancel'],
        onFormChange(result) {
            if (result.preset && PRESETS[result.preset]) this.setFormValues(PRESETS[result.preset], false);
        },
        onConfirm(result) {
            try {
                const settings = {
                    metallic: clamp(Number(result.metallic) || 0, 0, 100),
                    shininess: clamp(Number(result.shininess) || 0, 0, 100),
                    normal_strength: clamp(Number(result.normal_strength) || 0, 0, 100),
                    detail: clamp(Number(result.detail) || 0, 0, 100)
                };
                const resultData = generatePBR(source, settings);
                resultData.materialGroup.updateMaterial();
                resultData.textures[0].select();
                Blockbench.showQuickMessage('PBR material created and connected: Color + Normal + Height + MER.');
            } catch (error) {
                console.error('[PBR Material Generator]', error);
                Blockbench.showMessageBox({title: 'PBR Generation Failed', message: error.message || String(error), icon: 'error'});
                return false;
            }
        }
    });
    pbr_dialog.show();
}

/*
 * URL/file imports are registered by Blockbench under the ID derived from the
 * imported filename. Normalize that pending registration to our canonical ID
 * before Plugin.register runs. This makes the plugin appear in Installed and
 * gives Uninstall/Reload the same stable ID every time it is imported.
 */
function normalizePluginLoaderId() {
    const canonical = 'pbr_material_generator';
    if (typeof Plugins === 'undefined' || !Plugins.registered) return canonical;
    if (Plugins.registered[canonical]) return canonical;

    const pendingId = Object.keys(Plugins.registered).find(id => {
        const plugin = Plugins.registered[id];
        return plugin && !plugin.installed && plugin.path === '' &&
            (plugin.source === 'url' || plugin.source === 'file');
    });

    if (pendingId && pendingId !== canonical) {
        const plugin = Plugins.registered[pendingId];
        delete Plugins.registered[pendingId];
        plugin.id = canonical;
        Plugins.registered[canonical] = plugin;
    }
    return canonical;
}

Plugin.register(normalizePluginLoaderId(), {
    title: 'PBR Material Generator',
    author: 'yamasung7-dot',
    description: 'Generate and connect an editable PBR material from the selected Blockbench texture.',
    icon: 'texture',
    version: '0.2.1',
    variant: 'both',
    min_version: '4.9.0',
    new_repository_format: true,
    tags: ['Texture', 'PBR'],
    repository: 'https://github.com/yamasung7-dot/BP',
    onload() {
        pbr_action = new Action('pbr_material_generator', {
            name: 'Generate PBR Material',
            description: 'Generate and connect Normal, Height and MER maps to the selected texture',
            icon: 'texture',
            click: openPBRDialog
        });
        MenuBar.menus.tools.addAction(pbr_action);
    },
    oninstall() {
        Blockbench.showQuickMessage('PBR Material Generator installed.');
    },
    onunload() {
        if (pbr_dialog) {
            pbr_dialog.delete();
            pbr_dialog = null;
        }
        if (pbr_action) {
            pbr_action.delete();
            pbr_action = null;
        }
    },
    onuninstall() {
        Blockbench.showQuickMessage('PBR Material Generator uninstalled.');
    }
});