/*
 * @Author: lijianzhang
 * @Date: 2018-09-21 00:28:46
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-06 23:56:02
 */

interface Args {
    [k: string]: any;
}

class WorkPool {
    public workScripts: Map<string, () => Worker> = new Map();

    public pools: { work: Worker; isUse: boolean; name: string }[] = [];

    public queue: {
        name: string;
        args: Args;
        res: Function;
        rej: Function;
        transferable?: any[];
    }[] = [];
    private maxNum = navigator.hardwareConcurrency || 2;

    public registerWork(name: string, createWorker: () => Worker) {
        this.workScripts.set(name, createWorker);
    }
    /**
     *
     */
    public executeWork(
        name: string,
        args: Args,
        transferable?: any[],
        res?: Function,
        rej?: Function,
    ) {
        const pools = this.pools.filter(p => !p.isUse && p.name === name);
        if (pools.length) {
            const pool = pools.find(p => p.name === name);
            if (pool) {
                pool.isUse = true;

                return this.completeHandle(
                    pool.work,
                    args,
                    transferable,
                    res,
                    rej,
                );
            } else {
                const index = this.pools.findIndex(p => !p.isUse);
                this.pools[index].work.terminate();
                this.pools.splice(index, 1);

                return this.executeWork(name, args, transferable, res, rej);
            }
        } else {
            if (this.pools.length < this.maxNum) {
                const createWorker = this.workScripts.get(name);
                const work = createWorker();
                this.pools.push({ name, work, isUse: true });

                return this.completeHandle(work, args, transferable, res, rej);
            } else {
                return new Promise((res, rej) => {
                    this.queue.push({ name, args, transferable, res, rej });
                });
            }
        }
    }

    private stopWork(work: Worker) {
        const pool = this.pools.find(p => p.work === work);
        if (pool) pool.isUse = false;
        if (this.queue.length) {
            const { name, args, res, rej, transferable } = this.queue.shift();
            this.executeWork(name, args, transferable, res, rej);
        }
    }

    private completeHandle<T>(
        work: Worker,
        args: Args,
        transferable?: any[],
        res?: Function,
        rej?: Function,
    ) {
        work.postMessage(args, transferable);
        if (res && rej) {
            work.onmessage = v => {
                res(v.data);
                this.stopWork(work);
            };
            work.onerror = e => {
                rej(e.message);
                this.stopWork(work);
            };

            return work;
        } else {
            return new Promise<T>((res, rej) => {
                work.onmessage = v => {
                    res(v.data);
                    this.stopWork(work);
                };
                work.onerror = e => {
                    rej(e.message);
                    this.stopWork(work);
                };
            });
        }
    }
}

const workPool = new WorkPool();

export default workPool;
