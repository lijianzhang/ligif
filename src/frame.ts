/*
 * @Author: lijianzhang
 * @Date: 2018-09-16 00:10:40
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-20 00:07:11
 */

export interface IFrameOpiton {
    displayType?: number;
    useInput?: boolean;
    transparentColorIndex?: number;
    delay?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number,
}

let ii = 0;

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

    imgData: number[] = [];

    /**
     * 是否支持用户点击或按揭
     *
     * @type {boolean}
     * @memberof Frame
     */
    useInput: boolean = false;

    /**
     *像素
     *
     * @type {number[]}
     * @memberof Frame
     */
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
        if (!this.pixels) throw new Error('缺少数据');
        const canvas = document.createElement('canvas');
        this.ctx = canvas.getContext('2d')!;
        canvas.width = this.width
        canvas.height = this.height;

        let imgData = this.ctx.createImageData(this.w, this.h);
        this.pixels!.forEach((v, i) => imgData.data[i] = v);
        this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);

        if ((this.displayType === 1 || this.displayType === 2) && this.prevFrame)  {
            ii += 1;
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