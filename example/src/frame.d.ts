export interface IFrameOpiton {
    displayType?: number;
    useInput?: boolean;
    transparentColorIndex?: number;
    delay?: number;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    pixels?: number[];
}
export interface IFrame {
    useInput?: boolean;
    delay: number;
    x: number;
    y: number;
    w: number;
    h: number;
    pixels: number[];
}
export default class Frame {
    constructor(option?: IFrameOpiton);
    /**
     *上一帧
     *
     * @type {Frame}
     * @memberof Frame
     */
    prevFrame?: Frame;
    /**
     * 帧图片x轴坐标
     *
     * @type {number}
     * @memberof Frame
     */
    x: number;
    /**
     * 帧图片y轴坐标
     *
     * @type {number}
     * @memberof Frame
     */
    y: number;
    /**
     *帧图片高度
     *
     * @type {number}
     * @memberof Frame
     */
    h: number;
    /**
     * 帧图片宽度
     *
     * @type {number}
     * @memberof Frame
     */
    w: number;
    /**
     * 延迟多久后显示,单位: ms
     *
     * @type {number}
     * @memberof Frame
     */
    delay: number;
    /**
     * 是否排序 TODO: 目前没有实现
     *
     * @type {boolean}
     * @memberof Frame
     */
    sort: boolean;
    /**
     * 是否隔行排列像素
     *
     * @memberof Frame
     */
    isInterlace: boolean;
    /**
     *调试板
     *
     * @type {number[]}
     * @memberof Frame
     */
    palette: number[];
    /**
     * 是否使用全局调色板
     */
    isGlobalPalette: boolean;
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
    displayType: number;
    /**
     * 原始数据
     */
    imgData: number[];
    /**
     * 是否支持用户点击或按揭
     *
     * @type {boolean}
     * @memberof Frame
     */
    useInput: boolean;
    colorDepth: number;
    /**
     * 图片像素
     *
     * @type {number[]}
     * @memberof Frame
     */
    pixels: number[];
    /**
     * 第一帧宽度
     */
    readonly width: any;
    /**
     * 第一帧高度
     */
    readonly height: any;
    /**
     * frame所对应的canvas上下文
     */
    ctx?: CanvasRenderingContext2D;
    toData(): IFrame;
    /**
     * 将图片数据渲染到canvas
     * 通过canvas转换为各种数据
     *
     * @param {boolean} [retry=false]
     * @returns
     * @memberof Frame
     */
    renderToCanvas(retry?: boolean): CanvasRenderingContext2D;
}
