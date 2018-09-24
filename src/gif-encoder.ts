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

    async encodeByVideo(data: { src: string | File; from: number; to: number; fps: number; }) {

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
                    }else {
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
                }
                
                video.onloadeddata = () => {
                    next();
                }
                
            } catch (error) {
                rej(error);
            }           
        });
        return this.encode();
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