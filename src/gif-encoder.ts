import './lzw-encode'; // tslint:disable-line
import EncodeFrame from './frame/encode-Frame';
import NeuQuant from './neuquant';
import workPool from './work-pool';
import * as CONSTANTS from './constants';
/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 09:35:57
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-30 17:44:34
 */
export interface IDefalutFrameData {
    pixels: number[];
    delay?: number;
}

export interface ICanvasFrameData {
    img: HTMLCanvasElement;
    delay?: number;
}

export interface IImageFrameData {
    img: HTMLImageElement;
    delay?: number;
}

export interface IPixelsFrameData {
    w: number;
    h: number;
    pixels: number[];
    delay?: number;
}

const defaultOptions = {
    time: 0
};


const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));

 export default class GifEncoder {
    /**
     *
     * @param {number} w
     * @param {number} h
     * @param {number} [time=0] //如果0表示将一直循环
     * @memberof GifEncoder
     */
    constructor(w: number, h: number, options: { time?: number } = {}) {
        const o = {...defaultOptions, ...options};
        this.w = w;
        this.h = h;
        this.time = o.time;
    }

    /**
     * gif宽度
     *
     * @type {number}
     * @memberof GifEncoder
     */
    public w: number;

    /**
     * gif高度
     *
     * @type {number}
     * @memberof GifEncoder
     */
    public h: number;

    /**
     * 动画循环次数 0: 永久
     *
     * @type {number}
     * @memberof GifEncoder
     */
    public time: number;

    /**
     * 编码数据
     *
     * @type {number[]}
     * @memberof GifEncoder
     */
    public codes: number[] = [];

    /**
     * 帧数据
     *
     * @type {EncodeFrame[]}
     * @memberof GifEncoder
     */
    public frames: EncodeFrame[] = [];

    public addFrame(frame: ICanvasFrameData | IImageFrameData) {
        const data = this.toImageData(frame);
        const f = new EncodeFrame(data.w, data.h);
        f.pixels = data.pixels;
        f.delay = data.delay || 200;
        this.frames.push(f);
    }

    public addFrames(frames: (ICanvasFrameData | IImageFrameData) []) {
        frames.forEach(f => this.addFrame(f));
    }

    /**
     * 开始编码
     *
     * @memberof GifEncoder
     */
    public async encode() {
        console.time('encode time');
        this.optimizeImagePixels();
        this.parseFramePalette();
        await this.encodeFramePixels();
        this.writeHeader();
        this.writeLogicalScreenDescriptor();
        this.writeApplicationExtension();
        this.writeGraphicsControlExtension();
        this.addCode(CONSTANTS.endFlag);
        console.timeEnd('encode time');

        return this;
    }

    public toBlob() {
        const array = new ArrayBuffer(this.codes.length);
        const view = new DataView(array);
        this.codes.forEach((v, i) => view.setUint8(i, v));

        return new Blob([view], { type: 'image/gif' });
    }

    public async encodeByVideo(data: { src: string | File; from: number; to: number; fps: number }) {

        if (data.src instanceof File) {
            data.src = URL.createObjectURL(data.src);
        }
        const video = document.createElement('video');
        video.controls = true;
        video.src = data.src;

        await new Promise((res, rej) => {
            const delay = 1000 / data.fps;

            const imgs: any[] = [];
            let index = data.from;
            try {
                function next() {
                    if (index < Math.min(data.to, video.duration)) {
                        video.currentTime = index;
                        index += delay / 1000;
                    } else {
                        res(imgs);
                    }
                }
                video.onseeked = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.w || video.videoWidth;
                    canvas.height = this.h || video.videoHeight;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    this.addFrame({ img: canvas, delay });
                    next();
                };

                video.onloadeddata = () => {
                    next();
                };

            } catch (error) {
                rej(error);
            }
        });

        return this.encode();
    }

    private addCode(byte: number) {
        this.codes.push(byte);
    }

    private addCodes(bytes: number[]) {
        this.codes.push(...bytes);
    }

    private writeHeader() {
        this.addCodes(this.strTocode('GIF89a'));
    }

    private writeLogicalScreenDescriptor() {
        const firstImageData = this.frames[0];

        this.addCodes([this.w & 255, this.w >> 8]);  // w
        this.addCodes([this.h & 255, this.h >> 8]);  // w

        const globalPalette = firstImageData.palette;
        let m = 1 << 7; // globalColorTableFlag
        m += 0 << 4; // colorResolution
        m += 0 << 3; // sortFlag
        m += globalPalette.length ? Math.ceil(Math.log2(globalPalette.length / 3)) - 1 : 0; // sizeOfGlobalColorTable

        this.addCode(m);
        this.addCode(0); // backgroundColorIndex
        this.addCode(255); // pixelAspectRatio
        this.addCodes(globalPalette);
    }

    private writeApplicationExtension() {
        if (this.time !== 1) {
            // writeApplicationExtension
            this.addCode(CONSTANTS.extension);
            this.addCode(CONSTANTS.applicationExtension);
            this.addCode(11);
            this.addCodes(NETSCAPE2_0);
            this.addCode(3);
            this.addCode(1);
            this.addCodes([(this.time > 1 ? this.time - 1 : 0) & 255]);
            this.addCode((this.time > 1 ? this.time - 1 : 0) >> 8);
            this.addCode(0);
        }
    }

    private writeGraphicsControlExtension() {
        const globalPalette = this.frames[0].palette;
        this.frames.filter(data => data.w && data.h).forEach((frame) => {
            // 1. Graphics Control Extension
            this.addCode(CONSTANTS.extension); // exc flag
            this.addCode(CONSTANTS.imageExtension); // al
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
            this.addCode(CONSTANTS.imageDescriptor);
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

    private toImageData(frame: ICanvasFrameData | IImageFrameData): IPixelsFrameData {
        const canvas = document.createElement('canvas');
        canvas.width = this.w;
        canvas.height =  this.h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(frame.img, 0, 0, this.w, this.h);

        return {
            w: canvas.width,
            h: canvas.height,
            delay: frame.delay,
            pixels: [...ctx.getImageData(0, 0, this.w, this.h).data]
        };
    }

    // from: https://blog.csdn.net/jaych/article/details/51137341?utm_source=copy
    private colourDistance(rgb1: [number, number, number], rgb2: [number, number, number]) {
      const rmean = (rgb1[0] + rgb2[0]) / 2;
      const r = rgb1[0] - rgb2[0];
      const g = rgb1[1] - rgb2[1];
      const b = rgb1[2] - rgb2[2];

      return Math.sqrt((((rmean + 512) * r * r) >> 8) + g * g * 4 + (((767 - rmean) * b * b) >> 8));
    }

    private optimizeImagePixels() { // tslint:disable-line
        const lastPixels = [];

        this.frames.forEach(frame => { // tslint:disable-line
            const paletteMap = new Map();
            let palette: number[] = [];
            let x = frame.x;
            let y = frame.y;
            let w = frame.w;
            let h = frame.h;
            const pixels = frame.pixels;

            let newPixels: number[] = [];

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
                    } else {
                        newPixels.push(r1, g1, b1, 0);
                    }
                    transparencCount += 1;

                    if (!isDone) {
                        startNum += 1;
                    }
                    startOffset += 1;
                    endNum += 1;
                } else {
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
                    if (!isDone) isDone = true;
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

    private parseFramePalette() {
        const firstFrame = this.frames[0];
        const firstPalette = firstFrame.palette;

        let hasTransparenc = firstFrame.hasTransparenc;
        let transparencIndex: number | undefined;
        if (hasTransparenc) {
            transparencIndex = firstPalette.length / 3;
            firstPalette.push(0, 0, 0);
        }

        const otherFrames = this.frames.slice(1);
        otherFrames.forEach(frame => {
            const palette =   frame.palette;

            const firstPaletteCopy = firstPalette.slice();
            const diffPallette: number[] = [];
            for (let x = 0; x < palette.length; x += 3) {
                let hasSome = false;
                for (let y = 0; y < firstPaletteCopy.length; y += 3) {
                    if (
                        palette[x] === firstPalette[y] &&
                        palette[x + 1] === firstPalette[y + 1] &&
                        palette[x + 2] === firstPalette[y + 2]
                    ) {
                        hasSome = true;
                    }
                }
                if (!hasSome) diffPallette.push(...palette.slice(x, x + 3));
            }


            const isLocalPalette = (firstPalette.length + diffPallette.length) / 3 +
            ((!!frame.hasTransparenc && !hasTransparenc) ? 1 : 0) > 1 << Math.ceil(Math.log2(firstPalette.length / 3));

            if (frame.hasTransparenc) {
                // 添加透明色位置
                if (isLocalPalette) {
                    const transparencIndex = palette.length / 3;
                    frame.transparentColorIndex = transparencIndex;
                    palette.push(0, 0, 0);
                } else {
                    if (hasTransparenc) {
                        frame.transparentColorIndex = transparencIndex;
                    } else {
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
            } else {
                firstPalette.push(...diffPallette);
                frame.isGlobalPalette = true;
            }
        });

        firstFrame.hasTransparenc = hasTransparenc;
        firstFrame.transparentColorIndex = transparencIndex;
        firstFrame.isGlobalPalette = true;
        firstFrame.palette = this.fillPalette(firstPalette);
    }

    private fillPalette(palette: number[]) {
        const colorSize = Math.max(Math.ceil(Math.log2(palette.length / 3)), 2);
        const diff = (1 << colorSize) - palette.length / 3;
        const arr = new Array(diff * 3);
        arr.fill(0);

        return palette.concat(arr);
    }

    private async encodeFramePixels() {
        const globalPalette = this.frames[0].palette;

        return Promise.all(this.frames.map(async (imgData) => {
            const isZip = imgData.isZip;
            const transparentColorIndex = imgData.transparentColorIndex;
            const isGlobalPalette = imgData.isGlobalPalette;
            const pixels = imgData.pixels;

            const indexs: number[] = [];
            const palette = isGlobalPalette ? globalPalette : imgData.palette;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] === 0) {
                    indexs.push(transparentColorIndex!);
                } else {
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
                    } else {
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
            const codes = await workPool.executeWork('encode', [
                imgData.w,
                imgData.h,
                Math.log2(palette.length / 3),
                arr],
                [arr.buffer]
            );

            imgData.pixels = codes;

            return imgData;
        }));
    }

    private strTocode(str: string) {
        return str.split('').map(s => s.charCodeAt(0));
    }
 }
