
export interface NanoFlowNodeInput {
    [key: string]: any;
}

export interface NanoFlowNodeOutput {
    [key: string]: any;
}

export interface NanoFlowNodeContext {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export abstract class NanoFlowNode {
    abstract meta: {
        name: string;
        version: string;
        description: string;
        author: string;
        category: string;
        icon?: string;
    };

    abstract execute(input: NanoFlowNodeInput, context: NanoFlowNodeContext): Promise<NanoFlowNodeOutput>;
}
