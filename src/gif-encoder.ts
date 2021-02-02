/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 09:35:57
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-02 23:52:08
 */
import EncodeFrame from './frame/encode-Frame';
import NeuQuant from './neuquant';
import workPool from './work-pool';
import * as CONSTANTS from './constants';

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
    time: 0,
    colorDiff: 1,
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
    constructor(
        w: number,
        h: number,
        options: { time?: number; colorDiff?: number } = {},
    ) {
        const o = { ...defaultOptions, ...options };
        this.w = w;
        this.h = h;
        this.time = o.time;
        this.colorDiff = o.colorDiff;
    }

    colorDiff: number;

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

    public globalPalette: number[] = [];

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

    public addFrames(frames: (ICanvasFrameData | IImageFrameData)[]) {
        frames.forEach(f => this.addFrame(f));
    }

    /**
     * 开始编码
     *
     * @memberof GifEncoder
     */
    public async encode() {
        await this.optimizeImagePixels();
        this.parseFramePalette();
        await this.encodeFramePixels();
        this.writeHeader();
        this.writeLogicalScreenDescriptor();
        this.writeApplicationExtension();
        this.writeGraphicsControlExtension();
        this.addCode(CONSTANTS.endFlag);

        return this;
    }

    public toBlob() {
        const array = new ArrayBuffer(this.codes.length);
        const view = new DataView(array);
        this.codes.forEach((v, i) => view.setUint8(i, v));

        return new window.Blob([view], { type: 'image/gif' });
    }

    public async encodeByVideo(data: {
        src: string | File;
        from: number;
        to: number;
        fps: number;
    }) {
        if (data.src instanceof File) {
            data.src = URL.createObjectURL(data.src);
        }
        const video = document.createElement('video');
        video.controls = true;
        video.src = data.src;

        await new Promise((resolve, reject) => {
            const delay = 1000 / data.fps;

            const imgs: any[] = [];
            let index = data.from;
            try {
                // eslint-disable-next-line
                function next() {
                    if (index < Math.min(data.to, video.duration)) {
                        video.currentTime = index;
                        index += delay / 1000;
                    } else {
                        resolve(imgs);
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
                reject(error);
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
        this.addCodes([this.w & 255, this.w >> 8]); // w
        this.addCodes([this.h & 255, this.h >> 8]); // w

        const globalPalette = this.globalPalette;
        let m = 1 << 7; // globalColorTableFlag
        m += 0 << 4; // colorResolution
        m += 0 << 3; // sortFlag
        m += globalPalette.length
            ? Math.ceil(Math.log2(globalPalette.length / 3)) - 1
            : 0; // sizeOfGlobalColorTable

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
        const globalPalette = this.globalPalette;
        this.frames
            .filter(data => data.w && data.h)
            .forEach(frame => {
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
                const sizeOfColorTable =
                    Math.ceil(Math.log2(palette.length / 3)) - 1;
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

    private toImageData(
        frame: ICanvasFrameData | IImageFrameData,
    ): IPixelsFrameData {
        const canvas = document.createElement('canvas');
        canvas.width = this.w;
        canvas.height = this.h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(frame.img, 0, 0, this.w, this.h);

        return {
            w: canvas.width,
            h: canvas.height,
            delay: frame.delay,
            pixels: [...ctx.getImageData(0, 0, this.w, this.h).data],
        };
    }

    private async optimizeImagePixels() {
        // tslint:disable-line
        const datas = await workPool.executeWork('gif', {
            name: 'optimizePixels',
            frames: this.frames,
            width: this.w,
            maxDiff: this.colorDiff,
        });
        this.frames.forEach((frame, index) => {
            // tslint:disable-line
            let isZip = false;

            const {
                paletteMap,
                transparencCount,
                x,
                y,
                w,
                h,
                newPixels,
            } = datas[index];
            let palette = datas[index].palette;
            if (paletteMap.size > 256) {
                const nq = new NeuQuant(palette, {
                    netsize: transparencCount > 0 ? 255 : 256,
                    samplefac: 1,
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
        const globalFrame = this.frames.reduce((frame, current) => {
            if (!frame) return current;
            if (current.isZip) return frame;
            const colorDepth1 = Math.floor(Math.log2(frame.palette.length / 3));
            const colorDepth2 = Math.floor(
                Math.log2(current.palette.length / 3),
            );
            if (colorDepth1 < colorDepth2) {
                return current;
            } else if (colorDepth1 === colorDepth2) {
                return frame.palette.length > current.palette.length
                    ? current
                    : frame;
            }

            return frame;
        }, null);
        const firstPalette = globalFrame.palette;

        let hasTransparenc = globalFrame.hasTransparenc;
        let transparencIndex: number | undefined;
        if (hasTransparenc) {
            transparencIndex = firstPalette.length / 3;
            firstPalette.push(0, 0, 0);
        }

        this.frames.forEach(frame => {
            if (frame === globalFrame) return;
            const palette = frame.palette;

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

            const isLocalPalette =
                (firstPalette.length + diffPallette.length) / 3 +
                    (!!frame.hasTransparenc && !hasTransparenc ? 1 : 0) >
                1 << Math.ceil(Math.log2(firstPalette.length / 3));

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

        globalFrame.hasTransparenc = hasTransparenc;
        globalFrame.transparentColorIndex = transparencIndex;
        globalFrame.isGlobalPalette = true;
        globalFrame.palette = this.fillPalette(firstPalette);
        this.globalPalette = globalFrame.palette;
    }

    private fillPalette(palette: number[]) {
        const colorSize = Math.max(Math.ceil(Math.log2(palette.length / 3)), 2);
        const diff = (1 << colorSize) - palette.length / 3;
        const arr = new Array(diff * 3);
        arr.fill(0);

        return palette.concat(arr);
    }

    private async encodeFramePixels() {
        const globalPalette = this.globalPalette;

        return Promise.all(
            this.frames.map(async imgData => {
                const isZip = imgData.isZip;
                const transparentColorIndex = imgData.transparentColorIndex;
                const isGlobalPalette = imgData.isGlobalPalette;
                const pixels = imgData.pixels;

                const indexs: number[] = [];
                const palette = isGlobalPalette
                    ? globalPalette
                    : imgData.palette;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i + 3] === 0) {
                        indexs.push(transparentColorIndex!);
                    } else {
                        const r = pixels[i];
                        const g = pixels[i + 1];
                        const b = pixels[i + 2];

                        if (isZip) {
                            // from: https://github.com/unindented/neuquant-js/blob/master/src/helpers.js
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
                                if (
                                    palette[i] === r &&
                                    palette[i + 1] === g &&
                                    palette[i + 2] === b
                                ) {
                                    indexs.push(i / 3);
                                    break;
                                }
                            }
                        }
                    }
                }

                const arr = Uint8Array.from(indexs);
                const codes = await workPool.executeWork(
                    'gif',
                    {
                        name: 'encode',
                        width: imgData.w,
                        height: imgData.h,
                        colorDepth: Math.log2(palette.length / 3),
                        codes: arr,
                    }
                );

                imgData.pixels = codes;

                return imgData;
            }),
        );
    }

    private strTocode(str: string) {
        return str.split('').map(s => s.charCodeAt(0));
    }
}
