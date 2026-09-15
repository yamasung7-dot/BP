const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class FakeContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        for (let i = 0; i < this.pixels.length; i += 4) {
            this.pixels[i] = 128;
            this.pixels[i + 1] = 128;
            this.pixels[i + 2] = 128;
            this.pixels[i + 3] = 255;
        }
    }
    getImageData() { return {data: new Uint8ClampedArray(this.pixels)}; }
    createImageData(width, height) { return {data: new Uint8ClampedArray(width * height * 4)}; }
    putImageData(imageData) { this.pixels = new Uint8ClampedArray(imageData.data); }
}

class FakeCanvas {
    constructor(width = 4, height = 4) {
        this.width = width;
        this.height = height;
        this.ctx = new FakeContext(this);
    }
    getContext() { return this.ctx; }
    toDataURL() { return 'data:image/png;base64,TEST'; }
}

const registrations = [];
const actions = [];
const dialogs = [];
const generatedTextures = [];

const context = {
    console,
    Math,
    Uint8ClampedArray,
    document: {
        createElement(type) {
            assert.strictEqual(type, 'canvas');
            return new FakeCanvas();
        }
    },
    Plugin: {
        register(id, definition) { registrations.push({id, definition}); }
    },
    Action: class {
        constructor(id, options) {
            this.id = id;
            Object.assign(this, options);
            actions.push(this);
        }
        delete() {}
    },
    MenuBar: {menus: {tools: {addAction(action) { this.action = action; }}}},
    Dialog: class {
        constructor(options) {
            this.options = options;
            dialogs.push(this);
        }
        show() {}
        delete() {}
        setFormValues() {}
    },
    Blockbench: {
        showQuickMessage(message) { context.lastMessage = message; },
        showMessageBox(options) { context.lastError = options; }
    },
    Texture: null
};

context.Texture = class {
    constructor(options) {
        Object.assign(this, options);
        this.canvas = new FakeCanvas(options.width || 4, options.height || 4);
        generatedTextures.push(this);
    }
    add() {}
    select() { this.selected = true; }
};

context.Texture.selected = new context.Texture({name: 'test.png', width: 4, height: 4});

const source = fs.readFileSync('pbr_material_generator/pbr_material_generator.js', 'utf8');
vm.runInNewContext(source, context, {filename: 'pbr_material_generator.js'});

assert.strictEqual(registrations.length, 1, 'Plugin should register exactly once');
assert.strictEqual(registrations[0].id, 'pbr_material_generator');

registrations[0].definition.onload();
assert.strictEqual(actions.length, 1, 'Plugin should create one action');
assert.strictEqual(actions[0].name, 'Generate PBR Material');
assert.strictEqual(typeof actions[0].click, 'function');

actions[0].click();
assert.strictEqual(dialogs.length, 1, 'Tool should open one dialog');
const options = dialogs[0].options;
assert.ok(options.form.preset);
assert.ok(options.form.metallic);
assert.ok(options.form.shininess);
assert.ok(options.form.normal_strength);
assert.ok(options.form.detail);

assert.strictEqual(typeof options.onConfirm, 'function');
options.onConfirm({
    preset: 'metal',
    metallic: 95,
    shininess: 82,
    normal_strength: 45,
    detail: 35
});

assert.strictEqual(generatedTextures.length, 4, 'One source plus three generated textures should exist');
const generated = generatedTextures.slice(1);
assert.deepStrictEqual(generated.map(texture => texture.pbr_channel), ['normal', 'height', 'mer']);
assert.ok(generated.every(texture => texture.source.startsWith('data:image/png;base64,')));
assert.strictEqual(context.lastMessage, 'PBR maps generated: Normal, Height and MER.');
assert.strictEqual(context.lastError, undefined, 'Generation should not report an error');

console.log('Smoke test passed: registration, Tools action, settings dialog, PBR generation, and three output maps.');
