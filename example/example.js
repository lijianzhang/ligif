(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (factory());
}(this, (function () { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    const imageDescriptor = 0x2C; //44
    const extension = 0x21; // 33
    const imageExtension = 0xF9; // 249
    const plainTextExtension = 0x01; // 1
    const applicationExtension = 0xFF; // 255
    const commentExtension = 0xFE; // 254
    const endFlag = 0x3B; // 59

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-30 02:53:33
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 02:55:36
     */
    class BaseFrame {
        constructor(w, h, x = 0, y = 0) {
            this.colorDepth = 8;
            this.palette = [];
            this.pixels = [];
            this.isGlobalPalette = false;
            this.isInterlace = false;
            this.delay = 200;
            this.w = w;
            this.h = h;
            this.x = x;
            this.y = y;
        }
    }

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-21 00:28:46
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 11:38:45
     */
    class WorkPool {
        constructor() {
            this.workScripts = new Map();
            this.pools = [];
            this.queue = [];
            this.maxNum = navigator.hardwareConcurrency;
        }
        registerWork(name, fn) {
            let blob;
            if (fn instanceof Blob) {
                blob = fn;
            }
            else {
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
        executeWork(name, args, transferable, res, rej) {
            if (this.pools.length < this.maxNum) {
                const blob = this.workScripts.get(name);
                if (!blob)
                    throw new Error('无效的name');
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
                }
                else {
                    const index = this.pools.findIndex(p => !p.isUse);
                    this.pools[index].work.terminate();
                    this.pools.splice(index, 1);
                    return this.executeWork(name, args, transferable, res, rej);
                }
            }
            else {
                return new Promise((res, rej) => {
                    this.queue.push({ name, args, transferable, res, rej });
                });
            }
        }
        stopWork(work) {
            const pool = this.pools.find(p => p.work === work);
            if (pool)
                pool.isUse = false;
            if (this.queue.length) {
                const { name, args, res, rej, transferable } = this.queue.shift();
                this.executeWork(name, args, transferable, res, rej);
            }
        }
        completeHandle(work, args, transferable, res, rej) {
            work.postMessage(args, transferable);
            if (res && rej) {
                work.onmessage = (v) => {
                    res(v.data);
                    this.stopWork(work);
                };
                work.onerror = (e) => {
                    rej(e.message);
                    this.stopWork(work);
                };
                return work;
            }
            else {
                return new Promise((res, rej) => {
                    work.onmessage = (v) => {
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
    window.workPool = workPool;

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-15 19:40:17
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 17:46:25
     */
    workPool.registerWork('decode', (data) => {
        class LzwDecode {
            constructor(colorDepth) {
                this.dict2 = new Set();
                this.index = 0;
                this.remainingBits = 8;
                this.codes = [];
                this.defaultColorSize = Math.max(2, colorDepth);
                this.init();
            }
            decode(buffers) {
                this.buffers = buffers;
                const outputs = [];
                let code = this.clearCode;
                let prevCode;
                while (true) { // tslint:disable-line
                    prevCode = code;
                    code = this.nextCode();
                    if (code === this.endCode)
                        break;
                    if (code === this.clearCode) {
                        this.init();
                        continue;
                    }
                    if (code < this.dict.size) {
                        if (prevCode !== this.clearCode) {
                            this.insertSeq(this.getCodeSeq(prevCode).concat(this.getCodeSeq(code)[0]));
                        }
                    }
                    else {
                        if (code !== this.dict.size) {
                            throw new Error('无效的图形数据');
                        }
                        const seq = this.getCodeSeq(prevCode);
                        this.insertSeq(seq.concat(seq[0]));
                    }
                    outputs.push(...this.getCodeSeq(code));
                    // 当字典长度等于颜色数的时候, 下个code占位数增加
                    if (this.dict.size === (1 << this.colorSize) && this.colorSize < 12) {
                        this.colorSize += 1;
                    }
                }
                return Uint8Array.from(outputs);
            }
            init() {
                this.colorSize = this.defaultColorSize;
                this.dict = new Map();
                for (let index = 0; index < Math.pow(2, this.colorSize); index += 1) {
                    this.insertSeq([index]);
                }
                this.clearCode = 1 << this.colorSize;
                this.endCode = this.clearCode + 1;
                this.colorSize += 1;
                this.insertSeq([this.clearCode]);
                this.insertSeq([this.endCode]);
            }
            insertSeq(str) {
                const index = this.dict.size;
                this.dict.set(index, str);
                this.dict2.add(`this.colorSize: ${this.colorSize} codes: ${str.join(',')} index: ${index}`);
            }
            getCodeSeq(code) {
                return this.dict.get(code);
            }
            nextCode() {
                let colorSize = this.colorSize;
                let code = 0;
                let diff = 0;
                while (colorSize > 0) {
                    const buffer = this.buffers[this.index];
                    if (buffer === undefined) {
                        throw new Error('图片缺失数据');
                    }
                    const size = Math.min(colorSize, this.remainingBits);
                    code = ((buffer >> (8 - this.remainingBits) & (1 << size) - 1) << (diff)) | code;
                    colorSize -= this.remainingBits;
                    this.remainingBits -= size;
                    diff += size;
                    if (this.remainingBits <= 0) {
                        this.index += 1;
                        this.remainingBits = this.remainingBits % 8 + 8;
                    }
                }
                this.codes.push(code);
                return code;
            }
        }
        function decodeToPixels(data) {
            const decode = new LzwDecode(data.colorDepth);
            const codes = decode.decode(Uint8Array.from(data.imgData));
            const pixels = [];
            if (!data.isInterlace) {
                codes.forEach((k) => {
                    pixels.push(data.palette[k * 3]);
                    pixels.push(data.palette[k * 3 + 1]);
                    pixels.push(data.palette[k * 3 + 2]);
                    pixels.push(k === data.transparentColorIndex ? 0 : 255);
                });
            }
            else {
                const start = [0, 4, 2, 1];
                const inc = [8, 8, 4, 2];
                let index = 0;
                for (let pass = 0; pass < 4; pass += 1) { // from https://juejin.im/entry/59cc6fa151882550b3549bce
                    for (let i = start[pass]; i < data.h; i += inc[pass]) {
                        for (let j = 0; j < data.w; j += 1) {
                            const idx = (i - 1) * data.w * 4 + j * 4;
                            const k = codes[index];
                            pixels[idx] = data.palette[k * 3];
                            pixels[idx + 1] = data.palette[k * 3 + 1];
                            pixels[idx + 2] = data.palette[k * 3 + 2];
                            pixels[idx + 3] = k === data.transparentColorIndex ? 0 : 255;
                            index += 1;
                        }
                    }
                }
            }
            return pixels;
        }
        return decodeToPixels(data);
    });

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-30 02:53:35
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 19:46:38
     */
    class DecodeFrame extends BaseFrame {
        constructor() {
            super(...arguments);
            this.imgData = [];
            this.displayType = 0;
        }
        /**
         * 第一帧宽度
         */
        get width() {
            if (this.preFrame) {
                return this.preFrame.width;
            }
            return this.w + this.x;
        }
        /**
         * 第一帧高度
         */
        get height() {
            if (this.preFrame) {
                return this.preFrame.height;
            }
            return this.h + this.y;
        }
        decodeToPixels() {
            return __awaiter(this, void 0, void 0, function* () {
                const array = Uint8Array.from(this.imgData);
                const pixels = yield workPool.executeWork('decode', [{ imgData: array,
                        colorDepth: this.colorDepth,
                        palette: this.palette,
                        h: this.h,
                        w: this.w,
                        transparentColorIndex: this.transparentColorIndex,
                        isInterlace: this.isInterlace }], [array.buffer]);
                this.pixels = pixels;
            });
        }
        /**
         * 将图片数据渲染到canvas
         * 通过canvas转换为各种数据
         *
         * @param {boolean} [retry=false] 重新渲染
         * @returns
         * @memberof DecodeFrame
         */
        renderToCanvas(retry = false) {
            if (this.ctx && !retry)
                return this.ctx;
            if (!this.pixels)
                throw new Error('缺少数据');
            const canvas = document.createElement('canvas');
            this.ctx = canvas.getContext('2d');
            canvas.width = this.delegate.width;
            canvas.height = this.delegate.height;
            let imgData = this.ctx.getImageData(0, 0, this.w, this.h);
            this.pixels.forEach((v, i) => (imgData.data[i] = v));
            this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);
            if ((this.displayType === 1 || this.displayType === 2) &&
                this.preFrame) {
                if (!this.preFrame.ctx)
                    this.preFrame.renderToCanvas(retry);
                imgData = this.ctx.getImageData(0, 0, this.delegate.width, this.delegate.height);
                const prevImageData = this.preFrame.ctx.getImageData(0, 0, this.delegate.width, this.delegate.height);
                for (let i = 0; i < imgData.data.length; i += 4) {
                    if (imgData.data[i + 3] === 0) {
                        imgData.data[i] = prevImageData.data[i];
                        imgData.data[i + 1] = prevImageData.data[i + 1];
                        imgData.data[i + 2] = prevImageData.data[i + 2];
                        imgData.data[i + 3] = prevImageData.data[i + 3];
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
            }
            return this.ctx;
            // TODO: When displayType is equal to 3 or 4
        }
    }

    /**
     * gif文件解码器
     *
     * @export
     * @ class GifDecoder
     */
    class GifDecoder {
        constructor() {
            this.frames = [];
            /**
             * gif循环次数 0 代表永久
             *
             * @type {number}
             * @memberof GifDecoder
             */
            this.times = 0;
            /**
             * gif图像数组当前的游标
             *
             * @memberof GifDecoder
             */
            this.offset = 0;
        }
        readData(data) {
            return __awaiter(this, void 0, void 0, function* () {
                const fieldReader = new FileReader();
                fieldReader.readAsArrayBuffer(data);
                fieldReader.onload = this.handleImageData.bind(this);
                yield new Promise(res => fieldReader.onload = () => { res(); });
                yield this.handleImageData(fieldReader.result);
                return this;
            });
        }
        readCodes(data) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.handleImageData(data);
                return this;
            });
        }
        /**
         * 开始解析GIF图像
         *
         * @protected
         * @param {ArrayBuffer} data
         * @memberof GifDecoder
         */
        handleImageData(buffer) {
            return __awaiter(this, void 0, void 0, function* () {
                console.time('decode time');
                this.dataSource = new Uint8Array(buffer);
                this.readHeader();
                this.readLogicalScreenDescriptor();
                this.readExtension();
                yield Promise.all(this.frames.map(f => f.decodeToPixels()));
                console.timeEnd('decode time');
            });
        }
        /**
         * 读数据并且移动游标 移动距离等于 参数 len
         *
         * @private
         * @param {number} [len=1]
         * @returns Uint8Array
         * @memberof GifDecoder
         */
        read(len = 1) {
            return this.dataSource.slice(this.offset, this.offset += len);
        }
        /**
         * read 的快捷方法 返回一个 number
         *
         * @private
         * @returns number
         * @memberof GifDecoder
         */
        readOne() {
            return this.dataSource.slice(this.offset, this.offset += 1)[0];
        }
        /**
         * 只读一个数据, 不会移动 offset
         *
         * @private
         * @returns
         * @memberof GifDecoder
         */
        onlyReadOne() {
            return this.dataSource.slice(this.offset, this.offset + 1)[0];
        }
        readHeader() {
            const type = this.read(3).reduce((str, code) => str + String.fromCharCode(code), '');
            if (type !== 'GIF') {
                throw new Error('gif签名无效');
            }
            const version = this.read(3).reduce((str, code) => str + String.fromCharCode(code), '');
            this.version = version;
        }
        readLogicalScreenDescriptor() {
            const w = this.readOne() + (this.readOne() << 8);
            const h = this.readOne() + (this.readOne() << 8);
            this.width = w;
            this.height = h;
            const m = this.readOne();
            const globalColorTableFlag = !!(m >> 7 & 1);
            const colorDepth = m & 0b0111;
            // const sortFlag = !!(1 & (m >> 3)); // 暂时不需要
            // const colorResolution = (0b111 & m >> 4); // 暂时不需要
            const backgroundColorIndex = this.readOne();
            this.readOne(); // 读取 pixelAspectRatio 暂时不需要使用
            if (globalColorTableFlag) {
                const len = Math.pow(2, (colorDepth + 1)) * 3;
                this.globalPalette = this.readColorTable(len);
                this.backgroundColorIndex = backgroundColorIndex;
            }
        }
        /**
         * 读取调色板数据
         *
         * @private
         * @param {number} len
         * @returns
         * @memberof GifDecoder
         */
        readColorTable(len) {
            const palette = [];
            let index = 3;
            while (index <= len) {
                // TODO: 看看有没有更好的写法
                const rgb = this.read(3);
                palette.push(rgb[0]);
                palette.push(rgb[1]);
                palette.push(rgb[2]);
                index += 3;
            }
            return palette;
        }
        /**
         * 解析拓展
         *
         * @private
         * @memberof GifDecoder
         */
        readExtension() {
            switch (this.readOne()) {
                case extension: {
                    switch (this.readOne()) {
                        case imageExtension:
                            this.readGraphicsControlExtension();
                            this.readExtension();
                            break;
                        case commentExtension:
                            this.readCommentExtension();
                            this.readExtension();
                            break;
                        case applicationExtension:
                            this.readApplicationExtension();
                            this.readExtension();
                            break;
                        case plainTextExtension:
                            this.readPlainTextExtension();
                            this.readExtension();
                            break;
                        default:
                    }
                    break;
                }
                case imageDescriptor: {
                    this.readImageDescriptor();
                    this.readExtension();
                    break;
                }
                case endFlag: {
                    break;
                }
                case 0:
                    this.readExtension();
                    break;
                default:
                    throw new Error('错误的格式');
            }
        }
        readGraphicsControlExtension() {
            this.readOne(); // 跳过
            const m = this.readOne();
            const displayType = m >> 2 & 0b111;
            // const useInput = !!(0b1 & m >> 1); // 暂时不用
            const transparentColorFlag = !!(m & 0b1);
            const delay = (this.readOne() + (this.readOne() << 8)) * 10;
            const transparentColorIndex = this.readOne();
            this.frameOptions = {
                displayType,
                delay,
                transparentColorIndex: transparentColorFlag ? transparentColorIndex : undefined
            };
            this.readOne();
        }
        readCommentExtension() {
            const len = this.readOne();
            const arr = this.read(len + 1);
            this.commit = arr.reduce((s, c) => s + String.fromCharCode(c), '');
        }
        readApplicationExtension() {
            const len = this.readOne();
            if (len !== 11)
                throw new Error('解析失败: application extension is invalid data');
            const arr = this.read(len);
            this.appVersion = arr.reduce((s, c) => s + String.fromCharCode(c), '');
            this.readOne();
            this.readOne();
            this.times = this.readOne();
            while (this.onlyReadOne()) {
                this.readOne();
            }
        }
        readPlainTextExtension() {
            const len = this.readOne();
            this.read(len); // TODO: 暂时不处理, 直接跳过
        }
        readImageDescriptor() {
            const option = this.frameOptions || {};
            this.frameOptions = undefined;
            const x = this.readOne() + (this.readOne() << 8);
            const y = this.readOne() + (this.readOne() << 8);
            const w = this.readOne() + (this.readOne() << 8);
            const h = this.readOne() + (this.readOne() << 8);
            const frame = new DecodeFrame(w, h, x, y);
            frame.delegate = this;
            frame.preFrame = this.frames[this.frames.length - 1];
            Object.assign(frame, option);
            const m = this.readOne();
            const isLocalColor = !!(m >> 7 & 1);
            frame.isInterlace = !!(m >> 6 & 1);
            // frame.sort = !!(0b1 & m >> 5);
            const colorSize = (m & 0b111);
            if (isLocalColor) {
                const len = Math.pow(2, (colorSize + 1)) * 3;
                frame.palette = this.readColorTable(len);
            }
            else {
                frame.isGlobalPalette = true;
                frame.palette = this.globalPalette;
            }
            frame.colorDepth = this.readOne();
            // 解析图像数据
            const data = [];
            let len = this.readOne();
            while (len) {
                this.read(len).forEach(v => data.push(v));
                len = this.readOne();
            }
            frame.imgData = data;
            if (frame.w && frame.h)
                this.frames.push(frame);
        }
    }

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-15 19:40:17
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 11:44:04
     */
    workPool.registerWork('encode', (width, height, colorDepth, codes) => {
        class LzwEncoder {
            constructor(width, height, colorDepth) {
                this.dict = new Map();
                this.dict2 = new Map();
                this.remainingBits = 8;
                this.index = 0;
                this.codes = [];
                this.defaultColorSize = Math.max(2, colorDepth);
                this.buffers = new Uint8Array(width * height + 100);
                this.init();
            }
            init() {
                this.colorSize = this.defaultColorSize + 1;
                this.dict.clear();
                for (let index = 0; index < Math.pow(2, this.defaultColorSize); index += 1) {
                    this.insertSeq(index);
                }
                this.clearCode = 1 << this.defaultColorSize;
                this.endCode = this.clearCode + 1;
                this.insertSeq(this.clearCode);
                this.insertSeq(this.endCode);
            }
            insertSeq(str) {
                const index = this.dict.size;
                this.dict.set(str, index);
                this.dict2.set(str, index);
            }
            getSeqCode(str) {
                return this.dict.get(str);
            }
            encode(str) {
                let prefixCode = '';
                let i = 0;
                this.pushCode(this.clearCode);
                while (i < str.length) {
                    if (this.dict.size === 4097) {
                        this.pushCode(this.clearCode);
                        this.init();
                    }
                    else if (this.dict.size === (1 << this.colorSize) + 1) {
                        this.colorSize += 1;
                    }
                    const currentCode = str[i];
                    const key = prefixCode !== '' ? `${prefixCode},${currentCode}` : currentCode;
                    if (this.getSeqCode(key) !== undefined && str[i + 1] !== undefined) {
                        prefixCode = key;
                    }
                    else {
                        this.insertSeq(key);
                        this.pushCode(this.getSeqCode(prefixCode));
                        prefixCode = currentCode;
                    }
                    i += 1;
                }
                this.pushCode(this.getSeqCode(prefixCode));
                this.pushCode(this.endCode);
                return this.buffers.slice(0, this.index + 1);
            }
            pushCode(code) {
                this.codes.push(code);
                let colorSize = this.colorSize;
                let data = code;
                while (colorSize >= 0) {
                    const size = Math.min(colorSize, this.remainingBits);
                    const c = this.buffers[this.index] | data << (8 - this.remainingBits) & 255;
                    this.buffers[this.index] = c;
                    data >>= size;
                    colorSize -= this.remainingBits;
                    this.remainingBits -= size;
                    if (this.remainingBits <= 0) {
                        this.index += 1;
                        this.remainingBits = this.remainingBits % 8 + 8;
                    }
                }
            }
        }
        const encode = new LzwEncoder(width, height, colorDepth);
        return encode.encode(codes);
    });

    /*
     * @Author: lijianzhang
     * @Date: 2018-09-30 02:53:35
     * @Last Modified by: lijianzhang
     * @Last Modified time: 2018-09-30 03:23:02
     */
    class EncodeFrame extends BaseFrame {
        constructor() {
            super(...arguments);
            this.indexs = [];
            this.displayType = 0;
            this.isZip = false;
            this.hasTransparenc = false;
        }
    }

    /**
     * NeuQuant Neural-Network Quantization Algorithm
     *
     * Copyright (c) 1994 Anthony Dekker
     *
     * See "Kohonen neural networks for optimal colour quantization" in "Network:
     * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
     * the algorithm.
     *
     * See also http://members.ozemail.com.au/~dekker/NEUQUANT.HTML
     *
     * Any party obtaining a copy of these files from the author, directly or
     * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
     * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
     * this software and documentation files (the "Software"), including without
     * limitation the rights to use, copy, modify, merge, publish, distribute,
     * sublicense, and/or sell copies of the Software, and to permit persons who
     * receive copies from any such party to do so, with the only requirement being
     * that this copyright notice remain intact.
     *
     * Copyright (c) 2012 Johan Nordberg (JavaScript port)
     * Copyright (c) 2014 Devon Govett (JavaScript port)
     */
    // from: https://github.com/unindented/neuquant-js/blob/master/src/neuquant.js;
    const prime1 = 499;
    const prime2 = 491;
    const prime3 = 487;
    const prime4 = 503;
    const maxprime = Math.max(prime1, prime2, prime3, prime4);
    const minpicturebytes = (3 * maxprime);
    const defaults = {
        ncycles: 100,
        netsize: 256,
        samplefac: 10
    };
    class NeuQuant {
        constructor(pixels, options) {
            Object.assign(this, defaults, {
                pixels
            }, options);
            if (this.netsize < 4 || this.netsize > 256) {
                throw new Error('Color count must be between 4 and 256');
            }
            if (this.samplefac < 1 || this.samplefac > 30) {
                throw new Error('Sampling factor must be between 1 and 30');
            }
            this.maxnetpos = this.netsize - 1;
            this.netbiasshift = 4;
            this.intbiasshift = 16;
            this.intbias = (1 << this.intbiasshift);
            this.gammashift = 10;
            this.gamma = (1 << this.gammashift);
            this.betashift = 10;
            this.beta = (this.intbias >> this.betashift);
            this.betagamma = (this.beta * this.gamma);
            this.initrad = (this.netsize >> 3);
            this.radiusbiasshift = 6;
            this.radiusbias = (1 << this.radiusbiasshift);
            this.initradius = (this.initrad * this.radiusbias);
            this.radiusdec = 30;
            this.alphabiasshift = 10;
            this.initalpha = (1 << this.alphabiasshift);
            this.radbiasshift = 8;
            this.radbias = (1 << this.radbiasshift);
            this.alpharadbshift = (this.alphabiasshift + this.radbiasshift);
            this.alpharadbias = (1 << this.alpharadbshift);
            this.network = [];
            this.netindex = new Uint32Array(256);
            this.bias = new Uint32Array(this.netsize);
            this.freq = new Uint32Array(this.netsize);
            this.radpower = new Uint32Array(this.netsize >> 3);
            for (let i = 0, l = this.netsize; i < l; i++) {
                let v = (i << (this.netbiasshift + 8)) / this.netsize;
                this.network[i] = new Float64Array([v, v, v, 0]);
                this.freq[i] = this.intbias / this.netsize;
                this.bias[i] = 0;
            }
        }
        unbiasnet() {
            for (let i = 0, l = this.netsize; i < l; i++) {
                this.network[i][0] >>= this.netbiasshift;
                this.network[i][1] >>= this.netbiasshift;
                this.network[i][2] >>= this.netbiasshift;
                this.network[i][3] = i;
            }
        }
        altersingle(alpha, i, b, g, r) {
            this.network[i][0] -= (alpha * (this.network[i][0] - b)) / this.initalpha;
            this.network[i][1] -= (alpha * (this.network[i][1] - g)) / this.initalpha;
            this.network[i][2] -= (alpha * (this.network[i][2] - r)) / this.initalpha;
        }
        alterneigh(radius, i, b, g, r) {
            const lo = Math.abs(i - radius);
            const hi = Math.min(i + radius, this.netsize);
            let j = i + 1;
            let k = i - 1;
            let m = 1;
            while ((j < hi) || (k > lo)) {
                const a = this.radpower[m++];
                if (j < hi) {
                    const p = this.network[j++];
                    p[0] -= (a * (p[0] - b)) / this.alpharadbias;
                    p[1] -= (a * (p[1] - g)) / this.alpharadbias;
                    p[2] -= (a * (p[2] - r)) / this.alpharadbias;
                }
                if (k > lo) {
                    const p = this.network[k--];
                    p[0] -= (a * (p[0] - b)) / this.alpharadbias;
                    p[1] -= (a * (p[1] - g)) / this.alpharadbias;
                    p[2] -= (a * (p[2] - r)) / this.alpharadbias;
                }
            }
        }
        contest(b, g, r) {
            let bestd = ~(1 << 31);
            let bestbiasd = bestd;
            let bestpos = -1;
            let bestbiaspos = bestpos;
            for (let i = 0, l = this.netsize; i < l; i++) {
                let n = this.network[i];
                let dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);
                if (dist < bestd) {
                    bestd = dist;
                    bestpos = i;
                }
                let biasdist = dist - ((this.bias[i]) >> (this.intbiasshift - this.netbiasshift));
                if (biasdist < bestbiasd) {
                    bestbiasd = biasdist;
                    bestbiaspos = i;
                }
                let betafreq = (this.freq[i] >> this.betashift);
                this.freq[i] -= betafreq;
                this.bias[i] += (betafreq << this.gammashift);
            }
            this.freq[bestpos] += this.beta;
            this.bias[bestpos] -= this.betagamma;
            return bestbiaspos;
        }
        inxbuild() {
            let previouscol = 0;
            let startpos = 0;
            for (let i = 0, l = this.netsize; i < l; i++) {
                let p = this.network[i];
                let q = null;
                let smallpos = i;
                let smallval = p[1];
                for (let j = i + 1; j < l; j++) {
                    q = this.network[j];
                    if (q[1] < smallval) {
                        smallpos = j;
                        smallval = q[1];
                    }
                }
                q = this.network[smallpos];
                if (i !== smallpos) {
                    [p[0], q[0]] = [q[0], p[0]];
                    [p[1], q[1]] = [q[1], p[1]];
                    [p[2], q[2]] = [q[2], p[2]];
                    [p[3], q[3]] = [q[3], p[3]];
                }
                if (smallval !== previouscol) {
                    this.netindex[previouscol] = (startpos + i) >> 1;
                    for (let j = previouscol + 1; j < smallval; j++) {
                        this.netindex[j] = i;
                    }
                    previouscol = smallval;
                    startpos = i;
                }
            }
            this.netindex[previouscol] = (startpos + this.maxnetpos) >> 1;
            for (let i = previouscol + 1; i < 256; i++) {
                this.netindex[i] = this.maxnetpos;
            }
        }
        learn() {
            const lengthcount = this.pixels.length;
            const alphadec = 30 + ((this.samplefac - 1) / 3);
            const samplepixels = lengthcount / (3 * this.samplefac);
            let delta = samplepixels / this.ncycles | 0;
            let alpha = this.initalpha;
            let radius = this.initradius;
            let rad = radius >> this.radiusbiasshift;
            if (rad <= 1) {
                rad = 0;
            }
            for (let i = 0; i < rad; i++) {
                this.radpower[i] = alpha * (((rad * rad - i * i) * this.radbias) / (rad * rad));
            }
            let step;
            if (lengthcount < minpicturebytes) {
                this.samplefac = 1;
                step = 3;
            }
            else if ((lengthcount % prime1) !== 0) {
                step = 3 * prime1;
            }
            else if ((lengthcount % prime2) !== 0) {
                step = 3 * prime2;
            }
            else if ((lengthcount % prime3) !== 0) {
                step = 3 * prime3;
            }
            else {
                step = 3 * prime4;
            }
            let pix = 0;
            for (let i = 0; i < samplepixels;) {
                let b = (this.pixels[pix] & 0xff) << this.netbiasshift;
                let g = (this.pixels[pix + 1] & 0xff) << this.netbiasshift;
                let r = (this.pixels[pix + 2] & 0xff) << this.netbiasshift;
                let j = this.contest(b, g, r);
                this.altersingle(alpha, j, b, g, r);
                if (rad !== 0) {
                    this.alterneigh(rad, j, b, g, r);
                }
                pix += step;
                if (pix >= lengthcount) {
                    pix -= lengthcount;
                }
                if (delta === 0) {
                    delta = 1;
                }
                if (++i % delta === 0) {
                    alpha -= alpha / alphadec;
                    radius -= radius / this.radiusdec;
                    rad = radius >> this.radiusbiasshift;
                    if (rad <= 1) {
                        rad = 0;
                    }
                    for (let k = 0; k < rad; k++) {
                        this.radpower[k] = alpha * (((rad * rad - k * k) * this.radbias) / (rad * rad));
                    }
                }
            }
        }
        buildColorMap() {
            this.learn();
            this.unbiasnet();
            this.inxbuild();
        }
        getColorMap() {
            const map = new Uint8Array(this.netsize * 3);
            const index = new Uint8Array(this.netsize);
            for (let i = 0, l = this.netsize; i < l; i++) {
                index[this.network[i][3]] = i;
            }
            for (let i = 0, j = 0, k = 0, l = this.netsize; i < l; i++) {
                k = index[i];
                map[j++] = this.network[k][0] & 0xff;
                map[j++] = this.network[k][1] & 0xff;
                map[j++] = this.network[k][2] & 0xff;
            }
            return map;
        }
    }

    const defaultOptions = {
        time: 0
    };
    const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));
    class GifEncoder {
        /**
         *
         * @param {number} w
         * @param {number} h
         * @param {number} [time=0] //如果0表示将一直循环
         * @memberof GifEncoder
         */
        constructor(w, h, options = {}) {
            this.globalPalette = [];
            /**
             * 编码数据
             *
             * @type {number[]}
             * @memberof GifEncoder
             */
            this.codes = [];
            /**
             * 帧数据
             *
             * @type {EncodeFrame[]}
             * @memberof GifEncoder
             */
            this.frames = [];
            const o = Object.assign({}, defaultOptions, options);
            this.w = w;
            this.h = h;
            this.time = o.time;
        }
        addFrame(frame) {
            const data = this.toImageData(frame);
            const f = new EncodeFrame(data.w, data.h);
            f.pixels = data.pixels;
            f.delay = data.delay || 200;
            this.frames.push(f);
        }
        addFrames(frames) {
            frames.forEach(f => this.addFrame(f));
        }
        /**
         * 开始编码
         *
         * @memberof GifEncoder
         */
        encode() {
            return __awaiter(this, void 0, void 0, function* () {
                console.time('encode time');
                this.optimizeImagePixels();
                this.parseFramePalette();
                yield this.encodeFramePixels();
                this.writeHeader();
                this.writeLogicalScreenDescriptor();
                this.writeApplicationExtension();
                this.writeGraphicsControlExtension();
                this.addCode(endFlag);
                console.timeEnd('encode time');
                return this;
            });
        }
        toBlob() {
            const array = new ArrayBuffer(this.codes.length);
            const view = new DataView(array);
            this.codes.forEach((v, i) => view.setUint8(i, v));
            return new Blob([view], { type: 'image/gif' });
        }
        encodeByVideo(data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (data.src instanceof File) {
                    data.src = URL.createObjectURL(data.src);
                }
                const video = document.createElement('video');
                video.controls = true;
                video.src = data.src;
                yield new Promise((res, rej) => {
                    const delay = 1000 / data.fps;
                    const imgs = [];
                    let index = data.from;
                    try {
                        function next() {
                            if (index < Math.min(data.to, video.duration)) {
                                video.currentTime = index;
                                index += delay / 1000;
                            }
                            else {
                                res(imgs);
                            }
                        }
                        video.onseeked = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = this.w || video.videoWidth;
                            canvas.height = this.h || video.videoHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            this.addFrame({ img: canvas, delay });
                            next();
                        };
                        video.onloadeddata = () => {
                            next();
                        };
                    }
                    catch (error) {
                        rej(error);
                    }
                });
                return this.encode();
            });
        }
        addCode(byte) {
            this.codes.push(byte);
        }
        addCodes(bytes) {
            this.codes.push(...bytes);
        }
        writeHeader() {
            this.addCodes(this.strTocode('GIF89a'));
        }
        writeLogicalScreenDescriptor() {
            this.addCodes([this.w & 255, this.w >> 8]); // w
            this.addCodes([this.h & 255, this.h >> 8]); // w
            const globalPalette = this.globalPalette;
            let m = 1 << 7; // globalColorTableFlag
            m += 0 << 4; // colorResolution
            m += 0 << 3; // sortFlag
            m += globalPalette.length ? Math.ceil(Math.log2(globalPalette.length / 3)) - 1 : 0; // sizeOfGlobalColorTable
            this.addCode(m);
            this.addCode(0); // backgroundColorIndex
            this.addCode(255); // pixelAspectRatio
            this.addCodes(globalPalette);
        }
        writeApplicationExtension() {
            if (this.time !== 1) {
                // writeApplicationExtension
                this.addCode(extension);
                this.addCode(applicationExtension);
                this.addCode(11);
                this.addCodes(NETSCAPE2_0);
                this.addCode(3);
                this.addCode(1);
                this.addCodes([(this.time > 1 ? this.time - 1 : 0) & 255]);
                this.addCode((this.time > 1 ? this.time - 1 : 0) >> 8);
                this.addCode(0);
            }
        }
        writeGraphicsControlExtension() {
            const globalPalette = this.frames[0].palette;
            this.frames.filter(data => data.w && data.h).forEach((frame) => {
                // 1. Graphics Control Extension
                this.addCode(extension); // exc flag
                this.addCode(imageExtension); // al
                this.addCode(4); // byte size
                let m = 0;
                let displayType = 0;
                if (frame.x || frame.y || frame.hasTransparenc) {
                    displayType = 1;
                }
                m += displayType << 2;
                m += 1 << 1; // sortFlag
                m += frame.hasTransparenc ? 1 : 0;
                this.addCode(m);
                const delay = Math.floor(frame.delay / 10);
                this.addCodes([delay & 255, delay >> 8]);
                this.addCode(frame.transparentColorIndex || 0);
                this.addCode(0);
                // 2. image Descriptor
                this.addCode(imageDescriptor);
                this.addCodes([frame.x & 255, frame.x >> 8]); // add x, y, w, h
                this.addCodes([frame.y & 255, frame.y >> 8]); // add x, y, w, h
                this.addCodes([frame.w & 255, frame.w >> 8]); // add x, y, w, h
                this.addCodes([frame.h & 255, frame.h >> 8]); // add x, y, w, h
                m = 0;
                const isGlobalPalette = frame.isGlobalPalette;
                const palette = isGlobalPalette ? globalPalette : frame.palette;
                const sizeOfColorTable = Math.ceil(Math.log2(palette.length / 3)) - 1;
                const colorDepth = sizeOfColorTable + 1;
                if (!isGlobalPalette) {
                    m = (1 << 7) | sizeOfColorTable;
                }
                this.addCode(m);
                if (!isGlobalPalette) {
                    this.addCodes(palette);
                }
                // image data
                this.addCode(colorDepth);
                const c = [...frame.pixels];
                let len = c.length;
                while (len > 0) {
                    this.addCode(Math.min(len, 255));
                    this.addCodes(c.splice(0, 255));
                    len -= 255;
                }
                this.addCode(0);
            });
        }
        toImageData(frame) {
            const canvas = document.createElement('canvas');
            canvas.width = this.w;
            canvas.height = this.h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(frame.img, 0, 0, this.w, this.h);
            return {
                w: canvas.width,
                h: canvas.height,
                delay: frame.delay,
                pixels: [...ctx.getImageData(0, 0, this.w, this.h).data]
            };
        }
        // from: https://blog.csdn.net/jaych/article/details/51137341?utm_source=copy
        colourDistance(rgb1, rgb2) {
            const rmean = (rgb1[0] + rgb2[0]) / 2;
            const r = rgb1[0] - rgb2[0];
            const g = rgb1[1] - rgb2[1];
            const b = rgb1[2] - rgb2[2];
            return Math.sqrt((((rmean + 512) * r * r) >> 8) + g * g * 4 + (((767 - rmean) * b * b) >> 8));
        }
        optimizeImagePixels() {
            const lastPixels = [];
            this.frames.forEach(frame => {
                const paletteMap = new Map();
                let palette = [];
                let x = frame.x;
                let y = frame.y;
                let w = frame.w;
                let h = frame.h;
                const pixels = frame.pixels;
                let newPixels = [];
                // let alphaList: number[] = [];
                let startNum = 0; // 表示从0开始连续的透明像素的数目
                let isDone = false;
                let endNum = 0; // 表示连续的且到最后的透明像素的数目
                let startOffset = 0;
                let maxStartOffset = w; //左边空白像素
                let maxEndOffset = w; // 右边空白像素
                let isZip = false;
                let transparencCount = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                    const offset = ((y + Math.floor(index / (w * 4))) * this.w * 4) + ((index % (w * 4)) / 4 + x) * 4;
                    const r1 = pixels[index];
                    const r2 = lastPixels[offset];
                    const g1 = pixels[index + 1];
                    const g2 = lastPixels[offset + 1];
                    const b1 = pixels[index + 2];
                    const b2 = lastPixels[offset + 2];
                    const a = pixels[index + 3];
                    if ((index / 4) % w === 0) {
                        startOffset = 0;
                    }
                    const diff = this.colourDistance([r1, g1, b1], [r2, g2, b2]);
                    if (diff < 30 || a === 0) {
                        if (a === 0) {
                            newPixels.push(0, 0, 0, 0);
                        }
                        else {
                            newPixels.push(r1, g1, b1, 0);
                        }
                        transparencCount += 1;
                        if (!isDone) {
                            startNum += 1;
                        }
                        startOffset += 1;
                        endNum += 1;
                    }
                    else {
                        const c = `${r1},${g1},${b1}`;
                        if (!paletteMap.has(c)) {
                            palette.push(r1, g1, b1);
                            paletteMap.set(c, true);
                        }
                        newPixels.push(r1, g1, b1, a);
                        lastPixels[offset] = r1;
                        lastPixels[offset + 1] = g1;
                        lastPixels[offset + 2] = b1;
                        lastPixels[offset + 3] = a;
                        if (!isDone)
                            isDone = true;
                        maxStartOffset = startOffset < maxStartOffset ? startOffset : maxStartOffset;
                        endNum = 0;
                    }
                    if (maxEndOffset !== 0 && (index / 4 + 1) % w === 0) {
                        const endOffset = endNum % w;
                        maxEndOffset = endOffset < maxEndOffset ? endOffset : maxEndOffset;
                    }
                }
                transparencCount -= (startNum + endNum);
                const top = Math.floor(startNum / w);
                let start = 0;
                let end = pixels.length;
                if (top) {
                    start = top * w * 4;
                    y += top;
                    h -= top;
                }
                const bottom = Math.floor(endNum / w);
                if (bottom) {
                    end -= bottom * w * 4;
                    h -= bottom;
                }
                newPixels = newPixels.slice(start, end);
                if (maxEndOffset || maxStartOffset) {
                    newPixels = newPixels.filter((_, i) => {
                        const range = Math.floor(i / 4) % w;
                        if (range < maxStartOffset || range >= w - maxEndOffset) {
                            return false;
                        }
                        return true;
                    });
                    x += maxStartOffset;
                    w -= maxStartOffset + maxEndOffset;
                }
                if (paletteMap.size > 256) {
                    const nq = new NeuQuant(palette, {
                        netsize: transparencCount > 0 ? 255 : 256,
                        samplefac: 1
                    });
                    isZip = true;
                    nq.buildColorMap();
                    palette = [...nq.getColorMap()];
                }
                frame.x = x;
                frame.y = y;
                frame.w = w;
                frame.h = h;
                frame.isZip = isZip;
                frame.hasTransparenc = transparencCount > 0;
                frame.palette = palette;
                frame.pixels = newPixels;
            });
        }
        parseFramePalette() {
            const globalFrame = this.frames.reduce((frame, current) => {
                if (!frame)
                    return current;
                if (current.isZip)
                    return frame;
                const colorDepth1 = Math.floor(Math.log2(frame.palette.length / 3));
                const colorDepth2 = Math.floor(Math.log2(current.palette.length / 3));
                if (colorDepth1 < colorDepth2) {
                    return current;
                }
                else if (colorDepth1 === colorDepth2) {
                    return frame.palette.length > current.palette.length ? current : frame;
                }
                return frame;
            }, null);
            const firstPalette = globalFrame.palette;
            let hasTransparenc = globalFrame.hasTransparenc;
            let transparencIndex;
            if (hasTransparenc) {
                transparencIndex = firstPalette.length / 3;
                firstPalette.push(0, 0, 0);
            }
            this.frames.forEach(frame => {
                if (frame === globalFrame)
                    return;
                const palette = frame.palette;
                const firstPaletteCopy = firstPalette.slice();
                const diffPallette = [];
                for (let x = 0; x < palette.length; x += 3) {
                    let hasSome = false;
                    for (let y = 0; y < firstPaletteCopy.length; y += 3) {
                        if (palette[x] === firstPalette[y] &&
                            palette[x + 1] === firstPalette[y + 1] &&
                            palette[x + 2] === firstPalette[y + 2]) {
                            hasSome = true;
                        }
                    }
                    if (!hasSome)
                        diffPallette.push(...palette.slice(x, x + 3));
                }
                const isLocalPalette = (firstPalette.length + diffPallette.length) / 3 +
                    ((!!frame.hasTransparenc && !hasTransparenc) ? 1 : 0) > 1 << Math.ceil(Math.log2(firstPalette.length / 3));
                if (frame.hasTransparenc) {
                    // 添加透明色位置
                    if (isLocalPalette) {
                        const transparencIndex = palette.length / 3;
                        frame.transparentColorIndex = transparencIndex;
                        palette.push(0, 0, 0);
                    }
                    else {
                        if (hasTransparenc) {
                            frame.transparentColorIndex = transparencIndex;
                        }
                        else {
                            transparencIndex = firstPalette.length / 3;
                            frame.transparentColorIndex = transparencIndex;
                            firstPalette.push(0, 0, 0);
                            hasTransparenc = true;
                        }
                    }
                }
                if (isLocalPalette) {
                    // 添加是否使用全局颜色
                    frame.isGlobalPalette = false;
                    frame.palette = this.fillPalette([...palette]);
                }
                else {
                    firstPalette.push(...diffPallette);
                    frame.isGlobalPalette = true;
                }
            });
            globalFrame.hasTransparenc = hasTransparenc;
            globalFrame.transparentColorIndex = transparencIndex;
            globalFrame.isGlobalPalette = true;
            globalFrame.palette = this.fillPalette(firstPalette);
            this.globalPalette = globalFrame.palette;
        }
        fillPalette(palette) {
            const colorSize = Math.max(Math.ceil(Math.log2(palette.length / 3)), 2);
            const diff = (1 << colorSize) - palette.length / 3;
            const arr = new Array(diff * 3);
            arr.fill(0);
            return palette.concat(arr);
        }
        encodeFramePixels() {
            return __awaiter(this, void 0, void 0, function* () {
                const globalPalette = this.globalPalette;
                return Promise.all(this.frames.map((imgData) => __awaiter(this, void 0, void 0, function* () {
                    const isZip = imgData.isZip;
                    const transparentColorIndex = imgData.transparentColorIndex;
                    const isGlobalPalette = imgData.isGlobalPalette;
                    const pixels = imgData.pixels;
                    const indexs = [];
                    const palette = isGlobalPalette ? globalPalette : imgData.palette;
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (pixels[i + 3] === 0) {
                            indexs.push(transparentColorIndex);
                        }
                        else {
                            const r = pixels[i];
                            const g = pixels[i + 1];
                            const b = pixels[i + 2];
                            if (isZip) { // from: https://github.com/unindented/neuquant-js/blob/master/src/helpers.js
                                let minpos = 0;
                                let mind = 256 * 256 * 256;
                                for (let i = 0; i < palette.length; i += 3) {
                                    const dr = r - palette[i];
                                    const dg = g - palette[i + 1];
                                    const db = b - palette[i + 2];
                                    const d = dr * dr + dg * dg + db * db;
                                    const pos = (i / 3) | 0;
                                    if (d < mind) {
                                        mind = d;
                                        minpos = pos;
                                    }
                                    i += 1;
                                }
                                indexs.push(minpos);
                            }
                            else {
                                for (let i = 0; i < palette.length; i += 3) {
                                    if (palette[i] === r && palette[i + 1] === g && palette[i + 2] === b) {
                                        indexs.push(i / 3);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    const arr = Uint8Array.from(indexs);
                    const codes = yield workPool.executeWork('encode', [
                        imgData.w,
                        imgData.h,
                        Math.log2(palette.length / 3),
                        arr
                    ], [arr.buffer]);
                    imgData.pixels = codes;
                    return imgData;
                })));
            });
        }
        strTocode(str) {
            return str.split('').map(s => s.charCodeAt(0));
        }
    }

    window.GIFEncoder = GifEncoder;
    window.GIFDecoder = GifDecoder;
    document.getElementById('main').addEventListener('drop', test);
    document.getElementById('main').addEventListener('dragover', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    function test(e) {
        e.stopPropagation();
        e.preventDefault();
        const field = e.dataTransfer.files[0];
        const gif = new GifDecoder();
        window.gif = gif;
        gif.readData(field).then(gif => {
            gif.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
            const gIFEncoder = new GifEncoder(gif.width, gif.height);
            gIFEncoder.addFrames(gif.frames.map(f => ({ img: f.ctx.canvas, delay: f.delay })));
            gIFEncoder.encode().then(() => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                const b = new GifDecoder();
                window.b = b;
                b.readCodes(gIFEncoder.codes).then(() => b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas)));
            });
        });
    }
    const img1 = document.getElementById('img1');
    const img2 = document.getElementById('img2');
    const img3 = document.getElementById('img3');
    const encoder = new GifEncoder(img1.width, img1.height, { time: 10 });
    encoder.addFrame({ img: img1, delay: 1000 });
    encoder.addFrame({ img: img2, delay: 1000 });
    encoder.addFrame({ img: img3, delay: 1000 });
    encoder.encode().then(() => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(encoder.toBlob());
        document.body.appendChild(img);
    });
    // const field = document.getElementById('file') as HTMLInputElement;
    // field.onchange = () => {
    //     const a = new GIFEncoder(320, 180);
    //     a.encodeByVideo({ src: field.files[0], from: 1, to: 3, fps: 5 }).then(() => {
    //         const img = document.createElement('img');
    //         img.src = URL.createObjectURL(a.toBlob());
    //         document.body.appendChild(img);
    //         const b = new GIFDecoder();
    //         b.readCodes(a.codes).then(() => {
    //             b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
    //         });
    //     });
    // };

})));
