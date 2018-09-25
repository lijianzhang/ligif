import Frame from './frame';
import './lzw-decode';
export default class GifDecoder {
    constructor(data?: Blob);
    readData(data: Blob): Promise<this>;
    readCodes(data: number[]): Promise<this>;
    private fieldReader;
    private dataSource;
    private currentOptions?;
    private onLoad;
    next?(gif: this): any;
    frames: Frame[];
    private offset;
    /**
     * gif 宽度
     *
     * @type {number}
     * @memberof Gif
     */
    width: number;
    /**
     * gif高度
     *
     * @type {number}
     * @memberof Gif
     */
    height: number;
    appVersion?: string;
    /**
     * 如果其为 true ，则表示存在 Global Color Table。如果为 false，则没有 Global Color Table
     *
     * @type {boolean}
     * @memberof Gif
     */
    globalColorTableFlag: boolean;
    /**
     * 用于表示色彩分辨率，如果为 s，则 Global Color Table 的颜色数为 2^(s+1)个，如果这是 s = 1,则一共有 4 中颜色，即每个像素可以用 2位（二进制） 来表示
     *
     * @type {number}
     * @memberof Gif
     */
    colorResolution: number;
    /**
     * 如果为 false 则 Global Color Table 不进行排序，为 true 则表示 Global Color Table 按照降序排列，出现频率最多的颜色排在最前面。
     *
     * @type {boolean}
     * @memberof Gif
     */
    sortFlag: boolean;
    /**
     * 如其值为 s，则全局列表颜色个数的计算公式为 2^(s+1)。如 s = 1，则 Global Color Table 包含 4 个颜色
     *
     * @type {number}
     * @memberof Gif
     */
    colorDepth: number;
    /**
     * 表示 GIF 的背景色在 Global Color Table 中的索引。
     *
     * @type {number}
     * @memberof Gif
     */
    backgroundColorIndex: number;
    pixelAspectRatio: number;
    palette: number[];
    loaded: boolean;
    commit?: string;
    /**
     *循环播放次数
     *
     * @type {number}
     * @memberof Gif
     */
    times?: number;
    version: string;
    parsePixels(): Promise<void>;
    private read;
    private readOne;
    private getDataType;
    private readHeader;
    private readLogicalScreenDescriptor;
    private readColorTable;
    private readExtension;
    /**
     * name
     */
    private readGraphicsControlExtension;
    private readImageDescriptor;
    decodeToPixels(frame: Frame): Promise<void>;
    private readPlainTextExtension;
    private readApplicationExtension;
    private readCommentExtension;
}
