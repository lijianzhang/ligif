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

const defaultOption = {
    displayType: 0,
    useInput: false,
    delay: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    pixels: [],
    transparentColorIndex: undefined,
};
class Frame {
    constructor(option) {
        /**
         * 帧图片x轴坐标
         *
         * @type {number}
         * @memberof Frame
         */
        this.x = 0;
        /**
         * 帧图片y轴坐标
         *
         * @type {number}
         * @memberof Frame
         */
        this.y = 0;
        /**
         *帧图片高度
         *
         * @type {number}
         * @memberof Frame
         */
        this.h = 0;
        /**
         * 帧图片宽度
         *
         * @type {number}
         * @memberof Frame
         */
        this.w = 0;
        /**
         * 延迟多久后显示,单位: ms
         *
         * @type {number}
         * @memberof Frame
         */
        this.delay = 0;
        /**
         * 是否排序 TODO: 目前没有实现
         *
         * @type {boolean}
         * @memberof Frame
         */
        this.sort = false;
        /**
         * 是否隔行排列像素
         *
         * @memberof Frame
         */
        this.isInterlace = false;
        /**
         *调试板
         *
         * @type {number[]}
         * @memberof Frame
         */
        this.palette = [];
        /**
         * 是否使用全局调色板
         */
        this.isGlobalPalette = false;
        /**
         * 渲染改帧的方式
         * 0: 全覆盖式
         * 1: 会以上一帧做为背景进行渲染 (减少图片体积)
         * @type {(0 | 1 | 2 | 3)}
         * @memberof Frame
         */
        this.displayType = 0;
        /**
         * 原始数据
         */
        this.imgData = [];
        /**
         * 是否支持用户点击或按揭
         *
         * @type {boolean}
         * @memberof Frame
         */
        this.useInput = false;
        this.colorDepth = 8;
        const o = option ? Object.assign({ transparentColorIndex: undefined }, defaultOption, option) : defaultOption;
        this.displayType = o.displayType;
        this.useInput = o.useInput;
        this.delay = o.delay;
        this.transparentColorIndex = o.transparentColorIndex;
        this.x = o.x;
        this.y = o.y;
        this.h = o.h;
        this.w = o.w;
        this.pixels = o.pixels;
    }
    /**
     * 第一帧宽度
     */
    get width() {
        if (this.prevFrame) {
            return this.prevFrame.width;
        }
        return this.w;
    }
    /**
     * 第一帧高度
     */
    get height() {
        if (this.prevFrame) {
            return this.prevFrame.height;
        }
        return this.h;
    }
    toData() {
        return {
            x: this.x,
            y: this.y,
            w: this.w,
            h: this.h,
            pixels: this.pixels,
            delay: this.delay,
        };
    }
    /**
     * 将图片数据渲染到canvas
     * 通过canvas转换为各种数据
     *
     * @param {boolean} [retry=false]
     * @returns
     * @memberof Frame
     */
    renderToCanvas(retry = false) {
        if (this.ctx && !retry)
            return this.ctx;
        if (!this.pixels)
            throw new Error('缺少数据');
        const canvas = document.createElement('canvas');
        this.ctx = canvas.getContext('2d');
        canvas.width = this.width;
        canvas.height = this.height;
        let imgData = this.ctx.getImageData(0, 0, this.w, this.h);
        this.pixels.forEach((v, i) => imgData.data[i] = v);
        this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);
        if ((this.displayType === 1 || this.displayType === 2) && this.prevFrame) {
            if (!this.prevFrame.ctx)
                this.prevFrame.renderToCanvas(retry);
            imgData = this.ctx.getImageData(0, 0, this.width, this.height);
            const prevImageData = this.prevFrame.ctx.getImageData(0, 0, this.width, this.height);
            for (var i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i + 3] == 0) {
                    imgData.data[i] = prevImageData.data[i];
                    imgData.data[i + 1] = prevImageData.data[i + 1];
                    imgData.data[i + 2] = prevImageData.data[i + 2];
                    imgData.data[i + 3] = prevImageData.data[i + 3];
                }
            }
            this.ctx.putImageData(imgData, 0, 0);
        }
        return this.ctx;
        // TODO: When displayType is equal to 3
    }
}

/*
 * @Author: lijianzhang
 * @Date: 2018-09-21 00:28:46
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-24 16:35:19
 */
class WorkPool {
    constructor() {
        this.maxNum = navigator.hardwareConcurrency;
        this.workScripts = new Map();
        this.pools = [];
        this.queue = [];
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

/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:20
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-24 16:27:58
 */
workPool.registerWork('decode', (colorDepth, buffer) => {
    class LzwDecode {
        constructor(colorDepth) {
            this.index = 0;
            this.remainingBits = 8;
            this.codes = [];
            this.defaultColorSize = Math.max(2, colorDepth);
            this.init();
        }
        init() {
            this.colorSize = this.defaultColorSize;
            this.dict = new Map();
            for (let index = 0; index < Math.pow(2, this.colorSize); index++) {
                this.insertSeq([index]);
            }
            this.clearCode = 1 << this.colorSize;
            this.endCode = this.clearCode + 1;
            this.colorSize += 1;
            this.insertSeq([]);
            this.insertSeq([]);
        }
        insertSeq(str) {
            const index = this.dict.size;
            this.dict.set(index, str);
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
        decode(buffers) {
            this.buffers = buffers;
            const outputs = [];
            let code = this.clearCode;
            let prevCode;
            while (true) {
                prevCode = code;
                code = this.nextCode();
                if (code == this.endCode)
                    break;
                if (code == this.clearCode) {
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
                        debugger;
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
    }
    const decode = new LzwDecode(colorDepth);
    return decode.decode(buffer);
});

const CONSTANT_FALG = {
    imageDescriptor: 0x2C,
    extension: 0x21,
    imageExtension: 0xF9,
    plainTextExtension: 0x01,
    applicationExtension: 0xFF,
    commentExtension: 0xFE,
    endFlag: 0x3B,
};
function getFramePixles(frame) {
    const pixels = [];
    const data = frame.imgData;
    if (!frame.isInterlace) {
        data.forEach((k) => {
            pixels.push(frame.palette[k * 3]);
            pixels.push(frame.palette[k * 3 + 1]);
            pixels.push(frame.palette[k * 3 + 2]);
            pixels.push(k === frame.transparentColorIndex ? 0 : 255);
        });
    }
    else {
        let start = [0, 4, 2, 1];
        let inc = [8, 8, 4, 2];
        let index = 0;
        for (let pass = 0; pass < 4; pass++) {
            for (let i = start[pass]; i < frame.h; i += inc[pass]) {
                for (let j = 0; j < frame.w; j++) {
                    const idx = (i - 1) * frame.w * 4 + j * 4;
                    const k = data[index];
                    pixels[idx] = frame.palette[k * 3];
                    pixels[idx + 1] = frame.palette[k * 3 + 1];
                    pixels[idx + 2] = frame.palette[k * 3 + 2];
                    pixels[idx + 3] = k === frame.transparentColorIndex ? 0 : 255;
                    index += 1;
                }
            }
        }
    }
}
class GifDecoder {
    constructor(data) {
        this.frames = [];
        this.offset = 0;
        /**
         * 如果其为 true ，则表示存在 Global Color Table。如果为 false，则没有 Global Color Table
         *
         * @type {boolean}
         * @memberof Gif
         */
        this.globalColorTableFlag = false;
        /**
         * 用于表示色彩分辨率，如果为 s，则 Global Color Table 的颜色数为 2^(s+1)个，如果这是 s = 1,则一共有 4 中颜色，即每个像素可以用 2位（二进制） 来表示
         *
         * @type {number}
         * @memberof Gif
         */
        this.colorResolution = 1;
        /**
         * 如果为 false 则 Global Color Table 不进行排序，为 true 则表示 Global Color Table 按照降序排列，出现频率最多的颜色排在最前面。
         *
         * @type {boolean}
         * @memberof Gif
         */
        this.sortFlag = false;
        /**
         * 如其值为 s，则全局列表颜色个数的计算公式为 2^(s+1)。如 s = 1，则 Global Color Table 包含 4 个颜色
         *
         * @type {number}
         * @memberof Gif
         */
        this.colorDepth = 7;
        this.palette = [];
        this.loaded = false;
        if (data) {
            this.fieldReader = new FileReader();
            this.fieldReader.readAsArrayBuffer(data);
            this.fieldReader.onload = this.onLoad.bind(this);
        }
        workPool.registerWork('getFramePixles', getFramePixles);
    }
    readData(data, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            this.cb = cb;
            this.fieldReader = new FileReader();
            this.fieldReader.readAsArrayBuffer(data);
            yield new Promise(res => this.fieldReader.onload = () => { res(); });
            yield this.onLoad(new Uint8Array(this.fieldReader.result));
            return this;
        });
    }
    readCodes(data, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            this.cb = cb;
            yield this.onLoad(data);
            return this;
        });
    }
    onLoad(dataSource) {
        return __awaiter(this, void 0, void 0, function* () {
            this.dataSource = new Uint8Array(dataSource);
            this.readHeader();
            this.readLogicalScreenDescriptor();
            if (this.globalColorTableFlag) {
                const len = Math.pow(2, (this.colorDepth + 1)) * 3;
                this.palette = this.readColorTable(len);
            }
            while (!this.loaded) {
                this.readExtension();
            }
            yield this.parsePixels();
            if (this.next)
                this.next(this);
        });
    }
    parsePixels() {
        return __awaiter(this, void 0, void 0, function* () {
            let progress = 0;
            yield Promise.all(this.frames.map((f) => __awaiter(this, void 0, void 0, function* () {
                yield this.decodeToPixels(f);
                progress += 1 / this.frames.length * 100;
                if (this.cb)
                    this.cb(Math.ceil(progress));
            })));
            this.cb = undefined;
        });
    }
    read(len = 1) {
        return this.dataSource.slice(this.offset, this.offset += len);
    }
    readOne() {
        return this.dataSource.slice(this.offset, this.offset += 1)[0];
    }
    getDataType() {
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
        this.globalColorTableFlag = !!(1 & m >> 7);
        this.colorDepth = 0b0111 & m;
        this.sortFlag = !!(1 & (m >> 3));
        this.colorResolution = (0b111 & m >> 4);
        this.backgroundColorIndex = this.readOne();
        this.pixelAspectRatio = this.readOne();
    }
    readColorTable(len) {
        const palette = [];
        let index = 3;
        while (index <= len) {
            // TODO: 看看有没有更好的写法
            let rgb = this.read(3);
            palette.push(rgb[0]);
            palette.push(rgb[1]);
            palette.push(rgb[2]);
            index += 3;
        }
        return palette;
    }
    readExtension() {
        switch (this.readOne()) {
            case CONSTANT_FALG.extension: {
                switch (this.readOne()) {
                    case CONSTANT_FALG.imageExtension:
                        this.readGraphicsControlExtension();
                        break;
                    case CONSTANT_FALG.commentExtension:
                        this.readCommentExtension();
                        break;
                    case CONSTANT_FALG.applicationExtension:
                        this.readApplicationExtension();
                        break;
                    case CONSTANT_FALG.plainTextExtension:
                        this.readPlainTextExtension();
                        break;
                    default:
                        break;
                }
                break;
            }
            case CONSTANT_FALG.imageDescriptor: {
                this.readImageDescriptor();
                break;
            }
            case CONSTANT_FALG.endFlag: {
                this.loaded = true;
                break;
            }
            case 0:
                break;
            default:
                throw new Error('错误的格式');
                break;
        }
    }
    /**
     * name
     */
    readGraphicsControlExtension() {
        this.readOne(); // 跳过
        const m = this.readOne();
        const displayType = 0b111 & m >> 2;
        const useInput = !!(0b1 & m >> 1);
        const transparentColorFlag = !!(m & 0b1);
        const delay = (this.readOne() + (this.readOne() << 8)) * 10;
        const transparentColorIndex = this.readOne();
        this.currentOptions = {
            displayType,
            useInput,
            delay,
            transparentColorIndex: transparentColorFlag ? transparentColorIndex : undefined
        };
        this.readOne();
    }
    readImageDescriptor() {
        const option = this.currentOptions || {};
        const frame = new Frame(option);
        frame.prevFrame = this.frames[this.frames.length - 1];
        this.currentOptions = undefined;
        frame.x = this.readOne() + (this.readOne() << 8);
        frame.y = this.readOne() + (this.readOne() << 8);
        frame.w = this.readOne() + (this.readOne() << 8);
        frame.h = this.readOne() + (this.readOne() << 8);
        const m = this.readOne();
        const isLocalColor = !!(0b1 & m >> 7);
        frame.isInterlace = !!(0b1 & m >> 6);
        frame.sort = !!(0b1 & m >> 5);
        const colorSize = (0b111 & m);
        if (isLocalColor) {
            const len = Math.pow(2, (colorSize + 1)) * 3;
            frame.palette = this.readColorTable(len);
        }
        else {
            frame.palette = this.palette;
        }
        frame.colorDepth = this.readOne();
        // 解析图像数据
        let data = [];
        while (true) {
            let len = this.readOne();
            if (len) {
                this.read(len).forEach(v => data.push(v));
            }
            else {
                frame.imgData = data;
                // await this.decodeToPixels(frame, data, colorDepth);
                break;
            }
        }
        if (frame.w && frame.h)
            this.frames.push(frame);
    }
    decodeToPixels(frame) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Uint8Array.from(frame.imgData);
            const data = yield workPool.executeWork('decode', [frame.colorDepth, buffer], [buffer.buffer]);
            frame.pixels = [];
            if (!frame.isInterlace) {
                data.forEach((k) => {
                    frame.pixels.push(frame.palette[k * 3]);
                    frame.pixels.push(frame.palette[k * 3 + 1]);
                    frame.pixels.push(frame.palette[k * 3 + 2]);
                    frame.pixels.push(k === frame.transparentColorIndex ? 0 : 255);
                });
            }
            else {
                let start = [0, 4, 2, 1];
                let inc = [8, 8, 4, 2];
                let index = 0;
                for (let pass = 0; pass < 4; pass++) {
                    for (let i = start[pass]; i < frame.h; i += inc[pass]) {
                        for (let j = 0; j < frame.w; j++) {
                            const idx = (i - 1) * frame.w * 4 + j * 4;
                            const k = data[index];
                            frame.pixels[idx] = frame.palette[k * 3];
                            frame.pixels[idx + 1] = frame.palette[k * 3 + 1];
                            frame.pixels[idx + 2] = frame.palette[k * 3 + 2];
                            frame.pixels[idx + 3] = k === frame.transparentColorIndex ? 0 : 255;
                            index += 1;
                        }
                    }
                }
            }
        });
    }
    readPlainTextExtension() {
        const len = this.readOne();
        this.read(len); // TODO: 暂时不处理, 直接跳过
    }
    readApplicationExtension() {
        let len = this.readOne();
        if (len !== 11)
            throw new Error('解析失败: application extension is invalid data');
        const arr = this.read(len);
        this.appVersion = arr.reduce((s, c) => s + String.fromCharCode(c), '');
        this.readOne();
        this.readOne();
        this.times = this.readOne();
        while (this.getDataType()) {
            this.readOne();
        }
    }
    readCommentExtension() {
        const len = this.readOne();
        const arr = this.read(len + 1);
        this.commit = arr.reduce((s, c) => s + String.fromCharCode(c), '');
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

/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-24 16:35:43
 */
workPool.registerWork('encode', (width, height, colorDepth, codes) => {
    class LzwEncoder {
        constructor(width, height, colorDepth) {
            this.dict = new Map();
            this.remainingBits = 8;
            this.index = 0;
            this.defaultColorSize = Math.max(2, colorDepth);
            this.buffers = new Uint8Array(width * height + 100);
            this.init();
        }
        init() {
            this.colorSize = this.defaultColorSize + 1;
            this.dict.clear();
            for (let index = 0; index < Math.pow(2, this.defaultColorSize); index++) {
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
        }
        getSeqCode(str) {
            return this.dict.get(str);
        }
        encode(str) {
            let current;
            let next;
            let code;
            let i = 0;
            this.pushCode(this.clearCode);
            while (i < str.length) {
                current = str[i];
                next = str[i + 1];
                if (this.dict.size == 4096) {
                    this.pushCode(this.clearCode);
                    this.init();
                }
                else if (this.dict.size === (1 << this.colorSize) + 1) {
                    this.colorSize += 1;
                }
                while (next !== undefined && this.getSeqCode(`${current},${next}`) !== undefined) {
                    current = `${current},${next}`;
                    i += 1;
                    next = str[i + 1];
                }
                code = this.getSeqCode(current);
                if (next !== undefined) {
                    this.insertSeq(`${current},${next}`);
                }
                this.pushCode(code);
                i += 1;
            }
            this.pushCode(this.endCode);
            return this.buffers.slice(0, this.index + 1);
        }
        pushCode(code) {
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
 * @Date: 2018-09-22 18:14:54
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-25 10:29:14
 */
const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));
/**
 * 优化像素: 去掉相对于上一帧重复的像素
 *
 * @param {frames[]} imageDatas[]
 */
function optimizeImagePixels(frames) {
    const [firstFrameData, ...otherFrameDatas] = frames;
    const width = firstFrameData.w;
    const lastPixels = firstFrameData.pixels.slice();
    const datas = otherFrameDatas.map(frame => {
        let x = frame.x;
        let y = frame.y;
        let w = frame.w;
        let h = frame.h;
        let pixels = frame.pixels;
        let newPixels = [];
        // let alphaList: number[] = [];
        let startNum = 0; // 表示从0开始连续的透明像素的数目
        let isDone = false;
        let endNum = 0; // 表示连续的且到最后的透明像素的数目
        let startOffset = 0;
        let maxStartOffset = w; //左边空白像素
        let maxEndOffset = w; // 右边空白像素
        for (let index = 0; index < pixels.length; index += 4) {
            const offset = ((Math.floor(index / 4 / w) + y) * width + x + ((index / 4) % w)) * 4;
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
            if ((r1 === r2 && g1 === g2 && b1 === b2) || a === 0) {
                newPixels.push(0, 0, 0, 0);
                if (!isDone) {
                    startNum += 1;
                }
                startOffset += 1;
                endNum += 1;
            }
            else {
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
        const top = Math.floor(startNum / w);
        let start = 0;
        let end = pixels.length;
        if (top) {
            start = top * w * 4;
            y = top;
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
        return Object.assign({}, frame, { x,
            y,
            w,
            h, pixels: newPixels });
    });
    return [firstFrameData].concat(datas);
}
/**
 * 转换成压缩时需要的数据格式
 *
 * @param {IFrame} frame
 * @returns {IFrameData}
 */
function transformFrameToFrameData(frame) {
    const { w, h, pixels } = frame;
    const delay = Math.floor((frame.delay || 100) / 10);
    return {
        x: frame.x || 0,
        y: frame.y || 0,
        w,
        h,
        pixels,
        delay,
        palette: [],
        isGlobalPalette: false,
        isZip: false,
        hasTransparenc: false,
    };
}
/**
 * 填充调色板
 *
 * @param {number[]} palette
 * @returns
 */
function fillPalette(palette) {
    const colorSize = Math.max(Math.ceil(Math.log2(palette.length / 3)), 2);
    const diff = (1 << colorSize) - palette.length / 3;
    const arr = new Array(diff * 3);
    arr.fill(0);
    return palette.concat(arr);
}
/**
 * 解析帧的图像: 配置帧图像的颜色和透明数据
 * TODO: 只用全局调色板不一定生成的gif体积就小, 尤其在颜色深度比较小的 gif 比较明显;
 *      因为颜色深度变大后, image data 占据的位数也会变大, 所以还要看像素使用的频率,
 * 1. 或者改为,首先生成全部局部颜色, 再做对比, 根据颜色使用频率生成全局颜色板 (感觉比较困难, 和影响性能)
 * 2. 或者改为,当颜色深度超过某一值得时候不再增加?
 * @memberof GIFEncoder
 */
function parseFramePalette(frameDatas) {
    const firstFrameData = frameDatas[0];
    let firstPalette = firstFrameData.palette;
    let hasTransparenc = firstFrameData.hasTransparenc;
    let transparencIndex;
    if (hasTransparenc) {
        transparencIndex = firstPalette.length / 3;
        firstPalette.push(0, 0, 0);
    }
    const otherPixelInfos = frameDatas.slice(1);
    const imageDatas = otherPixelInfos.map(d => {
        const info = Object.assign({}, d);
        const palette = info.palette;
        let firstPaletteCopy = firstPalette.slice();
        let diffPallette = [];
        for (let x = 0; x < palette.length; x += 3) {
            let hasSome = false;
            for (let y = 0; y < firstPaletteCopy.length; y += 3) {
                if (palette[x] === firstPalette[y] &&
                    palette[x + 1] === firstPalette[y + 1] &&
                    palette[x + 2] === firstPalette[y + 2]) {
                    firstPaletteCopy.splice(y, 3);
                    y -= 3;
                    hasSome = true;
                }
            }
            if (!hasSome)
                diffPallette.push(...palette.slice(x, x + 3));
        }
        const isLocalPalette = (firstPalette.length + diffPallette.length) / 3
            + ((!!info.hasTransparenc && !hasTransparenc) ? 1 : 0)
            > 1 << Math.ceil(Math.log2(firstPalette.length / 3));
        if (info.hasTransparenc) {
            // 添加透明色位置
            if (isLocalPalette) {
                const transparencIndex = palette.length / 3;
                info.transparentColorIndex = transparencIndex;
                palette.push(0, 0, 0);
            }
            else {
                if (hasTransparenc) {
                    info.transparentColorIndex = transparencIndex;
                }
                else {
                    transparencIndex = firstPalette.length / 3;
                    firstPalette.push(0, 0, 0);
                    hasTransparenc = true;
                }
            }
        }
        if (isLocalPalette) {
            // 添加是否使用全局颜色
            info.isGlobalPalette = false;
            const p = fillPalette(Array.from(palette));
            info.palette = p;
        }
        else {
            firstPalette.push(...diffPallette);
            info.isGlobalPalette = true;
        }
        return info;
    });
    const info = Object.assign({}, firstFrameData);
    info.hasTransparenc = hasTransparenc;
    info.transparentColorIndex = transparencIndex;
    info.isGlobalPalette = true;
    info.palette = fillPalette(firstPalette);
    return [info].concat(imageDatas);
}
/** 压缩 */
function encodeFramePixels(frameDatas) {
    return __awaiter(this, void 0, void 0, function* () {
        const globalPalette = frameDatas[0].palette;
        return yield Promise.all(frameDatas.map((imgData) => __awaiter(this, void 0, void 0, function* () {
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
                            i++;
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
/**
 * 对颜色数超过设置的颜色质量参数, 减少颜色质量
 *
 * @param {frameData} IFrameData
 * @param {number} [colorDepth=8]
 *
 */
function decreasePalette(frameData, colorDepth = 8) {
    const colorMap = new Map();
    const pixels = frameData.pixels;
    let colors = [];
    for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];
        const c = a === 0 ? 'a' : `${r},${g},${b}`;
        if (!colorMap.has(c)) {
            colorMap.set(c, true);
            if (a !== 0)
                colors.push(r, g, b);
        }
    }
    if (colorMap.size > 1 << colorDepth) {
        const nq = new NeuQuant(colors, {
            netsize: colorMap.has('a') ? 255 : 256,
            samplefac: 1,
        });
        nq.buildColorMap();
        colors = Array.from(nq.getColorMap());
    }
    frameData.isZip = colorMap.size > 1 << colorDepth;
    frameData.hasTransparenc = !!colorMap.get('a');
    frameData.palette = colors;
    return frameData;
}
function strTocode(str) {
    return str.split('').map(s => s.charCodeAt(0));
}
function encoder(frames, time = 0, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        let imgDatas = optimizeImagePixels(frames.map(f => transformFrameToFrameData(f)));
        let progress = 33;
        if (cb)
            cb(progress);
        imgDatas = yield encodeFramePixels(parseFramePalette(imgDatas.map(d => decreasePalette(d))));
        progress += 33;
        if (cb)
            cb(progress);
        const codes = [];
        codes.push(...strTocode('GIF89a')); //头部识别信息
        // writeLogicalScreenDescriptor
        const firstImageData = imgDatas[0];
        codes.push(firstImageData.w & 255, firstImageData.w >> 8); // w
        codes.push(firstImageData.h & 255, firstImageData.h >> 8); // w
        const globalPalette = firstImageData.palette;
        let m = 1 << 7; // globalColorTableFlag
        m += 0 << 4; // colorResolution
        m += 0 << 3; // sortFlag
        m += globalPalette.length ? Math.ceil(Math.log2(globalPalette.length / 3)) - 1 : 0; // sizeOfGlobalColorTable
        codes.push(m);
        codes.push(0); // backgroundColorIndex
        codes.push(255); // pixelAspectRatio
        codes.push(...globalPalette);
        if (time !== 1) {
            // writeApplicationExtension
            codes.push(0x21);
            codes.push(255);
            codes.push(11);
            codes.push(...NETSCAPE2_0);
            codes.push(3);
            codes.push(1);
            codes.push((time > 1 ? time - 1 : 0) & 255);
            codes.push((time > 1 ? time - 1 : 0) >> 8);
            codes.push(0);
        }
        imgDatas.filter(data => data.w && data.h).forEach((data) => {
            // 1. Graphics Control Extension
            codes.push(0x21); // exc flag
            codes.push(0xf9); // al
            codes.push(4); // byte size
            let m = 0;
            let displayType = 0;
            if (data.x || data.y) {
                displayType = 2;
            }
            if (data.hasTransparenc) {
                displayType = 1;
            }
            m += displayType << 2;
            m += 1 << 1; // sortFlag
            m += data.hasTransparenc ? 1 : 0;
            codes.push(m);
            codes.push(data.delay & 255, data.delay >> 8);
            codes.push(data.transparentColorIndex || 0);
            codes.push(0);
            // 2. image Descriptor
            codes.push(0x2c);
            codes.push(data.x & 255, data.x >> 8); // add x, y, w, h
            codes.push(data.y & 255, data.y >> 8); // add x, y, w, h
            codes.push(data.w & 255, data.w >> 8); // add x, y, w, h
            codes.push(data.h & 255, data.h >> 8); // add x, y, w, h
            m = 0;
            const isGlobalPalette = data.isGlobalPalette;
            const palette = isGlobalPalette ? globalPalette : data.palette;
            const sizeOfColorTable = Math.ceil(Math.log2(palette.length / 3)) - 1;
            const colorDepth = sizeOfColorTable + 1;
            if (!isGlobalPalette) {
                m = (1 << 7) | sizeOfColorTable;
            }
            codes.push(m);
            if (!isGlobalPalette) {
                codes.push(...palette);
            }
            // image data
            codes.push(colorDepth);
            const c = Array.from(data.pixels);
            let len = c.length;
            while (len > 0) {
                codes.push(Math.min(len, 0xff));
                codes.push(...c.splice(0, 0xff));
                len -= 255;
            }
            codes.push(0);
            progress += 1 / imgDatas.length * 33;
            if (cb)
                cb(progress);
        });
        codes.push(0x3b);
        if (cb)
            cb(100);
        return codes;
    });
}

class GifEncoder {
    /**
     *
     * @param {number} w
     * @param {number} h
     * @param {number} [time=0] //如果0表示将一直循环
     * @memberof GifEncoder
     */
    constructor(w, h, time = 0) {
        this.frames = [];
        this.codes = [];
        this.w = w;
        this.h = h;
        this.time = time;
    }
    addFrame(frame) {
        let data;
        if (frame instanceof Frame) {
            data = frame.toData();
        }
        else if ('pixels' in frame) {
            data = {
                pixels: frame.pixels,
                delay: frame.delay,
                w: this.w,
                h: this.h,
            };
        }
        else if (frame.img) {
            data = this.toImageData(frame);
        }
        this.frames.push(data);
    }
    addFrames(frames) {
        frames.forEach(f => this.addFrame(f));
    }
    encode(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const codes = yield encoder(this.frames, this.time, cb);
            this.codes = codes;
        });
    }
    encodeByVideo(data, cb) {
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
            return this.encode(cb);
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
            pixels: Array.from(ctx.getImageData(0, 0, this.w, this.h).data)
        };
    }
    toBlob() {
        const array = new ArrayBuffer(this.codes.length);
        const view = new DataView(array);
        this.codes.forEach((v, i) => view.setUint8(i, v));
        return new Blob([view], { type: 'image/gif' });
    }
}

window.GIFEncoder = GifEncoder;
window.GIFDecoder = GifDecoder;
document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const field = e.dataTransfer.files[0];
    const gif = new GifDecoder();
    gif.readData(field, (progress) => console.log('progress:', progress)).then(gif => {
        gif.frames.forEach(f => f.renderToCanvas().canvas);
        setTimeout(() => {
            const gIFEncoder = new GifEncoder(gif.frames[0].w, gif.frames[0].h);
            gIFEncoder.addFrames(gif.frames);
            gIFEncoder.encode((progress) => console.log(progress)).then(() => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                const b = new GifDecoder();
                b.readCodes(gIFEncoder.codes).then(() => {
                    b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
                });
            });
        });
    });
});
document.getElementById('main').addEventListener('dragover', function (e) {
    e.stopPropagation();
    e.preventDefault();
});
const img1 = document.getElementById('img1');
const img2 = document.getElementById('img2');
const img3 = document.getElementById('img3');
const encoder$1 = new GifEncoder(img1.width, img1.height, 10);
encoder$1.addFrame({ img: img1, delay: 1000 });
encoder$1.addFrame({ img: img2, delay: 1000 });
encoder$1.addFrame({ img: img3, delay: 1000 });
encoder$1.encode().then(() => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(encoder$1.toBlob());
    document.body.appendChild(img);
});
const field = document.getElementById('file');
field.onchange = () => {
    const a = new GifEncoder(320, 180);
    a.encodeByVideo({ src: field.files[0], from: 1, to: 3, fps: 5 }).then(() => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(a.toBlob());
        document.body.appendChild(img);
        const b = new GifDecoder();
        b.readCodes(a.codes).then(() => {
            b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        });
    });
};

})));
