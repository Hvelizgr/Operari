
import { NodeVM } from 'vm2';
import { NodePlugin, NodePluginContext } from './PluginInterface';

export class PluginExecutor {
    private vm: NodeVM;

    constructor() {
        this.vm = new NodeVM({
            console: 'redirect',
            sandbox: {},
            require: {
                external: true, // Allow external modules? Be careful here.
                builtin: ['fs', 'path', 'util'], // Whitelist allowed built-ins
                root: './',
            },
            wrapper: 'commonjs', // Standard module wrapper
        });
    }

    public async executePlugin(pluginCode: string, inputs: any, context: NodePluginContext): Promise<any> {
        try {
            // We wrap the user code to inject the context and inputs
            // Assuming the pluginCode exports a "execute" function or is the execute function itself.
            // Let's assume the plugin exports a class/object conforming to NodePlugin interface.
            
            const wrappedScript = `
                module.exports = async function(inputs, context) {
                    ${pluginCode}
                    // If pluginCode defines 'execute', call it
                    if (typeof execute === 'function') {
                        return await execute(inputs, context);
                    }
                    // If pluginCode exports an object with execute
                    if (module.exports && typeof module.exports.execute === 'function') {
                         return await module.exports.execute(inputs, context);
                    }
                    throw new Error("Plugin must export an execute function");
                }
            `;

            // Capture logs from VM
            this.vm.on('console.log', (data) => context.log(data));
            this.vm.on('console.error', (data) => context.log(`ERROR: ${data}`));

            const pluginFn = this.vm.run(wrappedScript, 'plugin.js');
            return await pluginFn(inputs, context);

        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Plugin execution failed: ${error.message}`);
            }
            throw error;
        }
    }

    // Safer execution for loading pre-validated modules
    public async executeLoadedPlugin(plugin: NodePlugin, inputs: any, context: NodePluginContext): Promise<any> {
        // If the plugin is already loaded in memory (trusted), we can run it directly 
        // OR still run it in VM if we want isolation even for trusted implementations.
        // For trusted plugins loaded via PluginManager, we might skip VM overhead if performance is key,
        // BUT running inside VM prevents process crash on unhandled exceptions in plugin.
        
        // MVP: Execute directly for now if it's a loaded object from PluginManager
        return await plugin.execute(inputs, context);
    }
}
