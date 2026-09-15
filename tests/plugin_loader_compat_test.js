const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('pbr_material_generator/pbr_material_generator.js', 'utf8');
const registrations = [];

const context = {
    console,
    Plugins: {
        // Simulate Blockbench deriving an unexpected ID from a side-loaded URL.
        registered: {
            remote_plugin_alias: {
                installed: false,
                path: '',
                source: 'url'
            }
        }
    },
    Plugin: {
        register(id, definition) {
            registrations.push({id, definition});
        }
    }
};

vm.runInNewContext(source, context, {filename: 'pbr_material_generator.js'});

assert.strictEqual(registrations.length, 1, 'Plugin should register exactly once');
assert.strictEqual(
    registrations[0].id,
    'remote_plugin_alias',
    'Plugin should use Blockbench\'s pending side-loaded ID when it differs from the fallback ID'
);

console.log('Plugin loader compatibility test passed.');
