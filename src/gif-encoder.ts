import encoder from './encoder';
import Frame from './frame';

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

export interface IImageData {
    w: number;
    h: number;
    pixels: number[];
    delay?: number;
}

export default class GifEncoder {

    /**
     *
     * @param {number} w
     * @param {number} h
     * @param {number} [time=0] //如果0表示将一直循环
     * @memberof GifEncoder
     */
    constructor(w: number, h: number, time = 0) {
        this.w = w;
        this.h = h;
        this.time = time;
    }

    private w: number;
    private h: number;

    private time: number;

    private frames: IImageData[] = [];

    codes: number[] = [];

    addFrame(frame: IDefalutFrameData | ICanvasFrameData | IImageFrameData | Frame) {
        let data: IImageData;

        if (frame instanceof Frame) {
            data = frame.toData();
        } else if ('pixels' in frame) {
            data = {
                pixels: frame.pixels,
                delay: frame.delay,
                w: this.w,
                h: this.h,
            }
        } else if (frame.img) {
            data = this.toImageData(frame);
        }

        this.frames.push(data!);
    }

    addFrames(frames: (IDefalutFrameData | ICanvasFrameData | IImageFrameData | Frame) []) {
        frames.forEach(f => this.addFrame(f));
    }

    async encode() {
        const codes = await encoder(this.frames, this.time);
        this.codes = codes;
    }

    private toImageData(frame: ICanvasFrameData | IImageFrameData) {
        const canvas = document.createElement('canvas');
        canvas.width = this.w;
        canvas.height =  this.h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(frame.img, 0, 0, this.w, this.h);

        return {
            w: canvas.width,
            h: canvas.height,
            delay: frame.delay,
            pixels: Array.from(ctx.getImageData(0, 0, this.w, this.h).data)
        }
    }


    toBlob() {
        const array = new ArrayBuffer(this.codes.length);
        const view = new DataView(array);
        this.codes.forEach((v, i) => view.setUint8(i, v));
        return new Blob([view], { type: 'image/gif' });
    }
}