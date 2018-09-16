/*
 * @Author: lijianzhang
 * @Date: 2018-09-16 00:10:40
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-17 01:21:48
 */
import LZWDecode from './lzw-decode';
export interface IFrameOpiton {
    displayType?: number;
    useInput?: boolean;
    transparentColorIndex?: number;
    delay?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number
}

const defaultOption = {
    displayType: 0,
    useInput: false,
    delay: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
} as Required<IFrameOpiton>;

export default class Frame {
    constructor(option?: IFrameOpiton) {
        const o = option ? Object.assign({}, defaultOption, option) : defaultOption;

        this.displayType = o.displayType;
        this.useInput = o.useInput;
        this.delay = o.delay;
        this.transparentColorIndex = o.transparentColorIndex;
        this.x = o.x;
        this.y = o.y;
        this.h = o.h;
        this.w = o.w;
    }

    /**
     *上一帧
     *
     * @type {Frame}
     * @memberof Frame
     */
    prevFrame?: Frame;

    /**
     * 下一帧
     *
     * @type {Frame}
     * @memberof Frame
     */
    nextFrame?: Frame;

    /**
     * 帧图片x轴坐标
     *
     * @type {number}
     * @memberof Frame
     */
    x: number = 0;

    /**
     * 帧图片y轴坐标
     *
     * @type {number}
     * @memberof Frame
     */
    y: number = 0;

    /**
     *帧图片高度
     *
     * @type {number}
     * @memberof Frame
     */
    h: number = 0;

    /**
     * 帧图片宽度
     *
     * @type {number}
     * @memberof Frame
     */
    w: number = 0;

    /**
     * 延迟多久后显示
     *
     * @type {number}
     * @memberof Frame
     */
    delay: number = 0;

    /**
     *是非排序
     *
     * @type {boolean}
     * @memberof Frame
     */
    sort: boolean = false;

    /**
     * 是否隔行排列像素
     *
     * @memberof Frame
     */
    isInterlace = false;

    /**
     *调试板
     *
     * @type {number[]}
     * @memberof Frame
     */
    palette: number[] = [];

    /**
     * 最小颜色深度
     *
     * @type {number}
     * @memberof Frame
     */
    colorDepth:number = 2;

    /**
     * 透明颜色在调色板的索引
     *
     * @type {number}
     * @memberof Frame
     */
    transparentColorIndex?: number;

    /**
     * 渲染改帧的方式
     * 0: 全覆盖式
     * 1: 会以上一帧做为背景进行渲染 (减少图片体积)
     * @type {(0 | 1 | 2 | 3)}
     * @memberof Frame
     */
    displayType: number = 0;

    /**
     * 是否支持用户点击或按揭
     *
     * @type {boolean}
     * @memberof Frame
     */
    useInput: boolean = false;

    /**
     * 数据块 用来渲染
     *
     * @type {number[]}
     * @memberof Frame
     */
    bytes?: number[] = [];

    pixels!: number[];

    get width() {
        if (this.prevFrame) {
            return this.prevFrame.width;
        }
        return this.w;
    }

    get height() {
        if (this.prevFrame) {
            return this.prevFrame.height;
        }
        return this.h;
    }

    decodeToPixels() {
        const decoder = new LZWDecode(this.colorDepth);
        if (!this.bytes) throw new Error('缺少图像数据');
        this.pixels = [];
        const data = decoder.decode(new Uint8Array(this.bytes));
        if (!this.isInterlace) {
            data.forEach((k) => {
                this.pixels.push(this.palette[k * 3]);
                this.pixels.push(this.palette[k * 3 + 1]);
                this.pixels.push(this.palette[k * 3 + 2]);
                this.pixels.push(k === this.transparentColorIndex ? 0 : 255);
            });
        } else {
            let start = [0, 4, 2, 1];
            let inc = [8, 8, 4, 2];
            let index = 0;
            for (let pass = 0; pass < 4; pass++) {
                for (let i = start[pass]; i < this.h; i += inc[pass]) {
                    for (let j = 0; j < this.w; j++) {
                        const idx = (i - 1) * this.w * 4 + j * 4;
                        const k = data[index];
                        this.pixels[idx] = this.palette[k * 3];
                        this.pixels[idx + 1] = this.palette[k * 3 + 1];
                        this.pixels[idx + 2] = this.palette[k * 3 + 2];
                        this.pixels[idx + 3] = k === this.transparentColorIndex ? 0 : 255;
                        index += 1;
                    }
                }
            }
        }
    }

    ctx?: CanvasRenderingContext2D;

    /**
     * 将图片数据渲染到canvas
     * 通过canvas转换为各种数据
     *
     * @param {boolean} [retry=false]
     * @returns
     * @memberof Frame
     */
    renderToCanvas(retry = false) {
        if(this.ctx && !retry) return this.ctx;
        if (!this.pixels) this.decodeToPixels();
        const canvas = document.createElement('canvas');
        this.ctx = canvas.getContext('2d')!;
        canvas.width = this.width
        canvas.height = this.height;
        let imgData = this.ctx.createImageData(this.w, this.h);
        this.pixels!.forEach((v, i) => imgData.data[i] = v);
        this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);
        if ((this.displayType === 1 || this.displayType === 2) && this.prevFrame)  {
            if (!this.prevFrame.ctx) this.prevFrame.renderToCanvas(retry);
                imgData = this.ctx.getImageData(0, 0, this.width, this.height);
                const prevImageData = this.prevFrame.ctx!.getImageData(0, 0, this.width, this.height);
                for (var i = 0; i < imgData.data.length; i+=4) {
                    if (imgData.data[i+3] == 0) {
                        imgData.data[i] = prevImageData.data[i];
                        imgData.data[i+1] = prevImageData.data[i+1];
                        imgData.data[i+2] = prevImageData.data[i+2];
                        imgData.data[i+3] = prevImageData.data[i+3];
                    }
                }
                this.ctx.putImageData(imgData, 0, 0);
        }
        return this.ctx;
        // TODO: When displayType is equal to 3
    }
}