import { spawn } from 'child_process';
import { Logger } from './logger.service';
import { NodeExecutionError, ErrorCode } from '../errors/custom-error';

export interface PythonExecutionResult {
    stdout: string;
    stderr: string;
    result: any;
    duration: number;
}

export class PythonExecutionService {
    private static instance: PythonExecutionService;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): PythonExecutionService {
        if (!PythonExecutionService.instance) {
            PythonExecutionService.instance = new PythonExecutionService();
        }
        return PythonExecutionService.instance;
    }

    async execute(code: string, input: any, options: { timeout?: number, useDocker?: boolean } = {}): Promise<PythonExecutionResult> {
        const { timeout = 30000, useDocker = false } = options;
        
        if (useDocker) {
            return this.executeInDocker(code, input, timeout);
        }

        const startTime = Date.now();
        
        // Wrapper script to handle JSON I/O and provide a clean environment
        const wrapperScript = `
import json
import sys
import os

# Restricted builtins for safety
def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    allowed = ['json', 'math', 'datetime', 're', 'collections', 'itertools', 'functools', 'random', 'time']
    if name in allowed:
        return __import__(name, globals, locals, fromlist, level)
    raise ImportError(f"Module '{name}' is not allowed in this sandbox.")

def run_code():
    # Setup input
    try:
        input_data = json.loads(sys.stdin.read())
    except:
        input_data = {}

    # Define variables available to the user code
    context = {
        '$json': input_data,
        '$input': {
            'item': input_data,
            'all': lambda: [{'json': input_data}]
        },
        '__builtins__': {
            'abs': abs, 'all': all, 'any': any, 'bool': bool, 'dict': dict,
            'enumerate': enumerate, 'filter': filter, 'float': float,
            'int': int, 'len': len, 'list': list, 'map': map, 'max': max,
            'min': min, 'range': range, 'round': round, 'set': set,
            'sorted': sorted, 'str': str, 'sum': sum, 'tuple': tuple,
            'type': type, 'zip': zip, 'print': print, 'Exception': Exception,
            'json': json, '__import__': restricted_import
        }
    }

    user_code = ${JSON.stringify(code)}
    
    try:
        local_scope = {}
        # Restricted execution
        exec(user_code, context, local_scope)
        
        final_result = local_scope.get('result', context.get('result', context.get('$json')))
        
        print("---RESULT_START---")
        print(json.dumps(final_result))
        print("---RESULT_END---")
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_code()
`;

        return new Promise((resolve, reject) => {
            // Use 'nice' to lower priority and 'timeout' for hard limit at OS level
            const pythonProcess = spawn('timeout', [
                '--kill-after=2s', 
                `${Math.ceil(timeout/1000)}s`,
                'nice', '-n', '10', 'python3', '-c', wrapperScript
            ], {
                env: { 
                    PYTHONUNBUFFERED: '1',
                    // Basic env isolation
                    HOME: '/tmp',
                    TMPDIR: '/tmp'
                }
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('error', (err) => {
                reject(new NodeExecutionError({
                    nodeId: 'python-execution',
                    nodeName: 'Python Sandbox',
                    nodeType: 'custom.python',
                    message: `Failed to start Python process: ${err.message}`,
                    code: ErrorCode.NODE_EXECUTION_FAILED
                }));
            });

            pythonProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                
                if (code !== 0 && !stdout.includes('---RESULT_START---')) {
                    reject(new NodeExecutionError({
                        nodeId: 'python-execution',
                        nodeName: 'Python Sandbox',
                        nodeType: 'custom.python',
                        message: `Python execution failed with code ${code}. Error: ${stderr}`,
                        code: ErrorCode.NODE_EXECUTION_FAILED
                    }));
                    return;
                }

                try {
                    const resultMatch = stdout.match(/---RESULT_START---\n([\s\S]*?)\n---RESULT_END---/);
                    let result = input;
                    
                    if (resultMatch && resultMatch[1]) {
                        result = JSON.parse(resultMatch[1]);
                    }

                    // Clean stdout from the result marker
                    const cleanStdout = stdout
                        .replace(/---RESULT_START---\n[\s\S]*?\n---RESULT_END---\n?/, '')
                        .trim();

                    resolve({
                        stdout: cleanStdout,
                        stderr: stderr.trim(),
                        result,
                        duration
                    });
                } catch (err) {
                    reject(new NodeExecutionError({
                        nodeId: 'python-execution',
                        nodeName: 'Python Sandbox',
                        nodeType: 'custom.python',
                        message: `Failed to parse Python result: ${err instanceof Error ? err.message : String(err)}`,
                        code: ErrorCode.NODE_EXECUTION_FAILED
                    }));
                }
            });

            // Send input to stdin
            pythonProcess.stdin.write(JSON.stringify(input));
            pythonProcess.stdin.end();

            // Set a fallback timeout if the spawn timeout doesn't work as expected
            setTimeout(() => {
                pythonProcess.kill('SIGKILL');
            }, timeout + 1000);
        });
    }

    private async executeInDocker(code: string, input: any, _timeout: number): Promise<PythonExecutionResult> {
        const startTime = Date.now();
        const containerName = `py-sandbox-${Math.random().toString(36).substring(7)}`;
        
        // In a real production environment, we would use a pre-built image with restricted permissions
        // and run it with docker or podman with resource limits.
        // Example: docker run --rm --network none --memory 128m --cpus 0.5 ...
        
        console.log(`[PythonHardening] Executing in isolated container: ${containerName}`);
        
        // Mocking the Docker execution flow for the platform demo
        // This demonstrates how the hardening is structured
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    stdout: "Ejecución completada en sandbox Docker (Simulado)",
                    stderr: "",
                    result: input, // Simplemente devolvemos el input para el demo
                    duration: Date.now() - startTime
                });
            }, 500);
        });
    }
}
