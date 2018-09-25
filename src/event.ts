/*
 * @Author: lijianzhang
 * @Date: 2018-08-29 22:38:06
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-25 10:14:26
 */

export class Event {
    listenerMap: Map<string, Set<Function>> = new Map();

    on(type: string, fn: Function) {
        const set = this.listenerMap.get(type);
        if (set) {
            set.add(fn);
        } else {
            this.listenerMap.set(type, new Set([fn]));
        }
        return () => this.unListener(type, fn);
    }

    unListener(type: string, fn: Function) {
        const set = this.listenerMap.get(type);
        if (set) set.delete(fn);
    }

    emit(type: string, data: any) {
        const fns = this.listenerMap.get(type);
        if (fns) {
            fns.forEach((listener) => {
                listener(data);
            });
        }
    }
}
