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
    constructor(w: number, h: number, time?: number);
    private w;
    private h;
    private time;
    private frames;
    codes: number[];
    addFrame(frame: IDefalutFrameData | ICanvasFrameData | IImageFrameData | Frame): void;
    addFrames(frames: (IDefalutFrameData | ICanvasFrameData | IImageFrameData | Frame)[]): void;
    encode(): Promise<void>;
    encodeByVideo(data: {
        src: string | File;
        from: number;
        to: number;
        fps: number;
    }): Promise<void>;
    private toImageData;
    toBlob(): Blob;
}
