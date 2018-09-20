/*
 * @Author: lijianzhang
 * @Date: 2018-09-21 00:28:46
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-21 00:53:55
 */

export default function work(fn: Function | Blob) {
    let blob: Blob;
    if (fn instanceof Blob) {
        blob = fn;
    } else {
        var str = "onmessage=function(e){postMessage(" + fn + "(e.data))}";
        blob = new Blob([str], { type: 'application/javascript' });
    }

    const work = new Worker(URL.createObjectURL(blob));

    return (message: any) => {
        work.postMessage(message);
        return new Promise((res, rej) => {
            work.onmessage = (v) =>  res(v);
            work.onerror = (e) => rej(e);
        })
    }
}