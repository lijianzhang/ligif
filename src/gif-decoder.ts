/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:57:06
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-02 22:24:40
 */
import * as CONSTANT from './constants';
import DecodeFrame from './frame/decode-frame';
/**
 * gif文件解码器
 *
 * @export
 * @ class GifDecoder
 */
export default class GifDecoder {
    /**
     * gif 宽度
     *
     * @type {number}
     * @memberof GifDecoder
     */
    public width: number;

    /**
     * gif 高度
     *
     * @type {number}
     * @memberof GifDecoder
     */
    public height: number;

    /**
     * gif版本
     *
     * @type {string}
     * @memberof GifDecoder
     */
    public version: string;

    public frames: DecodeFrame[] = [];

    /**
     * 背景色在在全局调色板上的索引索引, 如果没有全局调色板, 则为 undefined
     *
     * @type {number}
     * @memberof GifDecoder
     */
    public backgroundColorIndex?: number;

    public globalPalette?: number[];

    /**
     * 注释
     *
     * @type {string}
     * @memberof GifDecoder
     */
    public commit?: string;

    /**
     * app信息
     *
     * @type {string}
     * @memberof GifDecoder
     */
    public appVersion?: string;

    /**
     * gif循环次数 0 代表永久
     *
     * @type {number}
     * @memberof GifDecoder
     */
    public times: number = 0;

    /**
     * gif图像数据
     *
     * @type {Uint8Array}
     * @memberof GifDecoder
     */
    private dataSource: Uint8Array;

    /**
     * gif图像数组当前的游标
     *
     * @memberof GifDecoder
     */
    private offset = 0;

    private frameOptions?: Partial<LiGif.IDecodeFrame>;

    get backgroundColor(): [number, number, number] | null {
        if (!('backgroundColorIndex' in this) || !this.globalPalette)
        { return null; }

        return [
            this.globalPalette[this.backgroundColorIndex],
            this.globalPalette[this.backgroundColorIndex + 1],
            this.globalPalette[this.backgroundColorIndex + 2],
        ];
    }

    public async readData(data: Blob) {
        const fieldReader = new FileReader();
        fieldReader.readAsArrayBuffer(data);
        fieldReader.onload = this.handleImageData.bind(this);
        await new Promise(
            res =>
                (fieldReader.onload = () => {
                    res(true);
                }),
        );
        await this.handleImageData(fieldReader.result as ArrayBuffer);

        return this;
    }

    public async readCodes(data: number[]) {
        await this.handleImageData(data);

        return this;
    }

    /**
     * 开始解析GIF图像
     *
     * @protected
     * @param {ArrayBuffer} data
     * @memberof GifDecoder
     */
    protected async handleImageData(buffer: ArrayBuffer | number[]) {
        this.dataSource = new Uint8Array(buffer);
        this.readHeader();
        this.readLogicalScreenDescriptor();
        this.readExtension();
        await Promise.all(this.frames.map(f => f.decodeToPixels()));
    }

    /**
     * 读数据并且移动游标 移动距离等于 参数 len
     *
     * @private
     * @param {number} [len=1]
     * @returns Uint8Array
     * @memberof GifDecoder
     */
    protected read(len = 1) {
        return this.dataSource.slice(this.offset, (this.offset += len));
    }

    /**
     * read 的快捷方法 返回一个 number
     *
     * @private
     * @returns number
     * @memberof GifDecoder
     */
    protected readOne() {
        return this.dataSource.slice(this.offset, (this.offset += 1))[0];
    }

    /**
     * 只读一个数据, 不会移动 offset
     *
     * @private
     * @returns
     * @memberof GifDecoder
     */
    protected onlyReadOne() {
        return this.dataSource.slice(this.offset, this.offset + 1)[0];
    }

    protected readHeader() {
        const type = this.read(3).reduce(
            (str, code) => str + String.fromCharCode(code),
            '',
        );

        if (type !== 'GIF') {
            throw new Error('gif签名无效');
        }

        const version = this.read(3).reduce(
            (str, code) => str + String.fromCharCode(code),
            '',
        );
        this.version = version;
    }

    protected readLogicalScreenDescriptor() {
        const w = this.readOne() + (this.readOne() << 8);
        const h = this.readOne() + (this.readOne() << 8);
        this.width = w;
        this.height = h;
        const m = this.readOne();
        const globalColorTableFlag = !!((m >> 7) & 1);

        const colorDepth = m & 0b0111;

        // const sortFlag = !!(1 & (m >> 3)); // 暂时不需要

        // const colorResolution = (0b111 & m >> 4); // 暂时不需要

        const backgroundColorIndex = this.readOne();

        this.readOne(); // 读取 pixelAspectRatio 暂时不需要使用

        if (globalColorTableFlag) {
            const len = 2 ** (colorDepth + 1) * 3;
            this.globalPalette = this.readColorTable(len);
            this.backgroundColorIndex = backgroundColorIndex;
        }
    }

    /**
     * 读取调色板数据
     *
     * @private
     * @param {number} len
     * @returns
     * @memberof GifDecoder
     */
    private readColorTable(len: number) {
        const palette: number[] = [];
        let index = 3;
        while (index <= len) {
            // TODO: 看看有没有更好的写法
            const rgb = this.read(3);
            palette.push(rgb[0]);
            palette.push(rgb[1]);
            palette.push(rgb[2]);
            index += 3;
        }

        return palette;
    }

    /**
     * 解析拓展
     *
     * @private
     * @memberof GifDecoder
     */
    private readExtension() {
        switch (this.readOne()) {
            case CONSTANT.extension: {
                switch (this.readOne()) {
                    case CONSTANT.imageExtension:
                        this.readGraphicsControlExtension();
                        this.readExtension();
                        break;
                    case CONSTANT.commentExtension:
                        this.readCommentExtension();
                        this.readExtension();
                        break;
                    case CONSTANT.applicationExtension:
                        this.readApplicationExtension();
                        this.readExtension();
                        break;
                    case CONSTANT.plainTextExtension:
                        this.readPlainTextExtension();
                        this.readExtension();
                        break;
                    default:
                }
                break;
            }
            case CONSTANT.imageDescriptor: {
                this.readImageDescriptor();
                this.readExtension();
                break;
            }
            case CONSTANT.endFlag: {
                break;
            }
            case 0:
                this.readExtension();
                break;
            default:
                throw new Error('错误的格式');
        }
    }

    private readGraphicsControlExtension() {
        this.readOne(); // 跳过
        const m = this.readOne();

        const displayType = (m >> 2) & 0b111;
        // const useInput = !!(0b1 & m >> 1); // 暂时不用
        const transparentColorFlag = !!(m & 0b1);
        const delay = (this.readOne() + (this.readOne() << 8)) * 10;

        const transparentColorIndex = this.readOne();
        this.frameOptions = {
            displayType,
            delay,
            transparentColorIndex: transparentColorFlag
                ? transparentColorIndex
                : undefined,
        };
        this.readOne();
    }

    private readCommentExtension() {
        const len = this.readOne();
        const arr = this.read(len + 1);
        this.commit = arr.reduce((s, c) => s + String.fromCharCode(c), '');
    }

    private readApplicationExtension() {
        const len = this.readOne();
        if (len !== 11)
        { throw new Error('解析失败: application extension is invalid data'); }

        const arr = this.read(len);
        this.appVersion = arr.reduce((s, c) => s + String.fromCharCode(c), '');
        this.readOne();
        this.readOne();
        this.times = this.readOne();

        while (this.onlyReadOne()) {
            this.readOne();
        }
    }

    private readPlainTextExtension() {
        const len = this.readOne();
        this.read(len); // TODO: 暂时不处理, 直接跳过
    }

    private readImageDescriptor() {
        const option = this.frameOptions || {};
        this.frameOptions = undefined;

        const x = this.readOne() + (this.readOne() << 8);
        const y = this.readOne() + (this.readOne() << 8);
        const w = this.readOne() + (this.readOne() << 8);
        const h = this.readOne() + (this.readOne() << 8);

        const frame = new DecodeFrame(w, h, x, y);
        frame.delegate = this;
        frame.preFrame = this.frames[this.frames.length - 1];
        Object.assign(frame, option);

        const m = this.readOne();
        const isLocalColor = !!((m >> 7) & 1);
        frame.isInterlace = !!((m >> 6) & 1);
        // frame.sort = !!(0b1 & m >> 5);
        const colorSize = m & 0b111;
        if (isLocalColor) {
            const len = 2 ** (colorSize + 1) * 3;
            frame.palette = this.readColorTable(len);
        } else {
            frame.isGlobalPalette = true;
            frame.palette = this.globalPalette;
        }

        frame.colorDepth = this.readOne();
        // 解析图像数据
        const data: number[] = [];

        let len = this.readOne();
        while (len) {
            this.read(len).forEach(v => data.push(v));
            len = this.readOne();
        }
        frame.imgData = data;
        if (frame.w && frame.h) this.frames.push(frame);
    }
}
