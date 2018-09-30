/*
 * @Author: lijianzhang
 * @Date: 2018-09-21 00:28:46
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-30 11:38:45
 */

class WorkPool {

    public workScripts: Map<string, Blob> = new Map();

    public pools: { work: Worker; isUse: boolean; name: string }[] = [];

    public queue: {name: string; args: any[]; res: Function; rej: Function; transferable?: any[]}[] = [];
    private maxNum = navigator.hardwareConcurrency;

    public registerWork(name: string, fn: Function | Blob) {
        let blob: Blob;
        if (fn instanceof Blob) {
            blob = fn;
        } else {
            const str = `
                var fn = ${fn};
                onmessage=function(e, transferable){
                    const v = fn(...e.data, transferable);
                    postMessage(v);
                }
            `;
            blob = new Blob([str], { type: 'application/javascript' });
            this.workScripts.set(name, blob);
        }
    }

    /**
     *
     */
    public executeWork(name: string, args: any[], transferable?: any[], res?: Function, rej?: Function) {
        if (this.pools.length < this.maxNum) {
            const blob = this.workScripts.get(name);
            if (!blob) throw new Error('无效的name');
            const work = new Worker(URL.createObjectURL(blob));
            this.pools.push({ name, work, isUse: true });

            return this.completeHandle(work, args, transferable, res, rej);
        }
        const pools = this.pools.filter(p => !p.isUse);
        if (pools.length) {
            const pool = pools.find(p => p.name === name);
            if (pool) {
                pool.isUse = true;

                return this.completeHandle(pool.work, args, transferable, res, rej);
            }  else {
                const index = this.pools.findIndex(p => !p.isUse);
                this.pools[index].work.terminate();
                this.pools.splice(index, 1);

                return this.executeWork(name, args, transferable, res, rej);
            }
        } else {
            return new Promise((res, rej) => { // tslint:disable-line
                this.queue.push({ name, args, transferable, res, rej});
            });
        }
    }

    private stopWork(work: Worker) {
        const pool = this.pools.find(p => p.work === work);
        if (pool) pool.isUse = false;
        if (this.queue.length) {
            const { name, args, res, rej, transferable } = this.queue.shift()!;
            this.executeWork(name, args, transferable, res, rej);
        }
    }

    private completeHandle<T>(work: Worker, args: any[], transferable?: any[], res?: Function, rej?: Function) {
        work.postMessage(args, transferable);
        if (res && rej) {
            work.onmessage = (v) =>  {
                res(v.data);
                this.stopWork(work);
            };
            work.onerror = (e) => {
                rej(e.message);
                this.stopWork(work);
            };

            return work;
        } else {
            return new Promise<T>((res, rej) => {
                work.onmessage = (v) =>  {
                    res(v.data);
                    this.stopWork(work);
                };
                work.onerror = (e) => {
                    rej(e.message);
                    this.stopWork(work);
                };
            });
        }
    }
}

const workPool = new WorkPool();
(window as any).workPool = workPool;
export default workPool;
