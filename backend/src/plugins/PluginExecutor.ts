import { NodePlugin, NodePluginContext } from './PluginInterface';

interface SandboxOptions {
    timeout?: number;
    memoryLimit?: number;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_MEMORY_LIMIT = 128;

export class PluginExecutor {
    private timeout: number;
    private memoryLimit: number;

    constructor(options: SandboxOptions = {}) {
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
        this.memoryLimit = options.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
    }

    public async executePlugin(pluginCode: string, inputs: any, context: NodePluginContext): Promise<any> {
        const logs: string[] = [];
        const safeContext = {
            log: (msg: string) => {
                logs.push(String(msg));
                context.log(msg);
            },
            nodeId: context.nodeId,
            executionId: context.executionId,
            workflowId: context.workflowId,
        };

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            
            const restrictedGlobals = {
                console: {
                    log: safeContext.log,
                    error: (msg: string) => safeContext.log(`ERROR: ${msg}`),
                    warn: (msg: string) => safeContext.log(`WARN: ${msg}`),
                },
                JSON,
                Math,
                Date,
                Array,
                Object,
                String,
                Number,
                Boolean,
                Map,
                Set,
                Promise,
                parseInt,
                parseFloat,
                isNaN,
                isFinite,
                encodeURIComponent,
                decodeURIComponent,
                encodeURI,
                decodeURI,
            };

            const wrappedCode = `
                return (async function(inputs, context) {
                    "use strict";
                    ${pluginCode}
                    if (typeof execute === 'function') {
                        return await execute(inputs, context);
                    }
                    throw new Error("Plugin must define an execute function");
                })(inputs, context);
            `;

            const sandboxedFn = new AsyncFunction(
                'inputs',
                'context',
                ...Object.keys(restrictedGlobals),
                wrappedCode
            );

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Plugin execution timeout (${this.timeout}ms)`)), this.timeout);
            });

            const result = await Promise.race([
                sandboxedFn(inputs, safeContext, ...Object.values(restrictedGlobals)),
                timeoutPromise,
            ]);

            return result;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Plugin execution failed: ${error.message}`);
            }
            throw error;
        }
    }

    public async executeLoadedPlugin(plugin: NodePlugin, inputs: any, context: NodePluginContext): Promise<any> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Plugin execution timeout (${this.timeout}ms)`)), this.timeout);
        });

        try {
            const result = await Promise.race([
                plugin.execute(inputs, context),
                timeoutPromise,
            ]);
            return result;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Plugin execution failed: ${error.message}`);
            }
            throw error;
        }
    }
}
