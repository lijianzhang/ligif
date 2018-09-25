declare class WorkPool {
    private maxNum;
    workScripts: Map<string, Blob>;
    pools: {
        work: Worker;
        isUse: boolean;
        name: string;
    }[];
    registerWork(name: string, fn: Function | Blob): void;
    queue: {
        name: string;
        args: any[];
        res: Function;
        rej: Function;
        transferable?: any[];
    }[];
    /**
     *
     */
    executeWork(name: string, args: any[], transferable?: any[], res?: Function, rej?: Function): any;
    private stopWork;
    private completeHandle;
}
declare const workPool: WorkPool;
export default workPool;
