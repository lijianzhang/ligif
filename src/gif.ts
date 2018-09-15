/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 21:52:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-16 01:05:03
 */
import Frame from './frame';
import LzwEncode from  './lzw-encode';
import LzwDecode from './lzw-decode';

const CONSTANT_FALG = {
    imageDescriptor: 0x2C,
    extension: 0x21,
    imageExtension: 0xF9,
    plainTextExtension: 0x01,
    applicationExtension: 0xFF,
    commentExtension: 0xFE,
    endFlag: 0x3B,
};

export default class Gif {
    constructor(data: Blob) {
        this.fieldReader = new FileReader();
        this.fieldReader.readAsArrayBuffer(data);
        this.fieldReader.onload = this.onLoad.bind(this);
        (window as any).gif = this;
    }

    private fieldReader: FileReader;

    private dataSource!: Uint8Array;

    private onLoad() {
        this.dataSource = new Uint8Array(this.fieldReader.result as ArrayBuffer);
        this.readHeader();
        this.readLogicalScreenDescriptor();
        if (this.globalColorTableFlag) {
            this.readGlobalColorTable();
        }

        while (!this.loaded) {
            this.readExtension();
        }
        
    }

    frames: Frame[] = [];


    private offset = 0;

    /**
     * gif 宽度
     *
     * @type {number}
     * @memberof Gif
     */
    public width!: number;

    /**
     * gif高度
     *
     * @type {number}
     * @memberof Gif
     */
    public height!: number;


    /**
     * 如果其为 true ，则表示存在 Global Color Table。如果为 false，则没有 Global Color Table
     *
     * @type {boolean}
     * @memberof Gif
     */
    globalColorTableFlag: boolean = false;

    /**
     * 用于表示色彩分辨率，如果为 s，则 Global Color Table 的颜色数为 2^(s+1)个，如果这是 s = 1,则一共有 4 中颜色，即每个像素可以用 2位（二进制） 来表示
     *
     * @type {number}
     * @memberof Gif
     */
    colorResolution: number = 1;

    /**
     * 如果为 false 则 Global Color Table 不进行排序，为 true 则表示 Global Color Table 按照降序排列，出现频率最多的颜色排在最前面。
     *
     * @type {boolean}
     * @memberof Gif
     */
    sortFlag: boolean = false;

    /**
     * 如其值为 s，则全局列表颜色个数的计算公式为 2^(s+1)。如 s = 1，则 Global Color Table 包含 4 个颜色
     *
     * @type {number}
     * @memberof Gif
     */
    sizeOfGlobalColorTable: number = 1;


    /**
     * 表示 GIF 的背景色在 Global Color Table 中的索引。
     *
     * @type {number}
     * @memberof Gif
     */
    backgroundColorIndex!: number;

    // 表示 GIF 的背景色在 Global Color Table 中的索引。
    pixelAspectRatio!: number;

    colors: string[] = [];

    loaded = false;


    version!: string;

    read(len = 1) {
        return this.dataSource.slice(this.offset, this.offset += len);
    }

    readOne() {
        return this.dataSource.slice(this.offset, this.offset += 1)[0];
    }

    _read(len) {
        return this.dataSource.slice(this.offset, this.offset + len);
    }

    getDataType() {
        return this.dataSource.slice(this.offset, this.offset + 1)[0];
    }

    private readHeader() {
        const type = this.read(3).reduce((str, code) => str + String.fromCharCode(code), '');

        if (type !== 'GIF') {
            throw new Error('gif签名无效');
        }

        const version = this.read(3).reduce((str, code) => str + String.fromCharCode(code), '')
        this.version = version;

    }

    private readLogicalScreenDescriptor() {
        const w = this.readOne() + (this.readOne() << 8);
        const h = this.readOne() + (this.readOne() << 8);
        this.width = w;
        this.height = h;
        const m = this.readOne();
        this.globalColorTableFlag = !!(1 & m >> 7);

        this.sizeOfGlobalColorTable = 0b0111 & m >> 4;

        this.sortFlag = !!(1 & (m >> 3));

        this.colorResolution = (0b111 & m);

        this.backgroundColorIndex = this.readOne();
        this.pixelAspectRatio = this.readOne();
    }

    private readGlobalColorTable() {
        const len =  2 ** (this.sizeOfGlobalColorTable + 1) * 3;
        console.log('len', len);
        let index = 3;
        while (index <= len) {
            // TODO: 看看有没有更好的方法
            const color = this.read(3).reduce((c, b) => {
                const code = b.toString(16);
                if (code.length === 1) {
                    return c + '0' + code;
                }
                return c + code;
            }, '');
            this.colors.push(color);
            index += 3;
        };
    }

    public readExtension() {
        switch (this.readOne()) {
            case CONSTANT_FALG.extension: {
                switch (this.readOne()) {
                    case CONSTANT_FALG.imageExtension:
                        this.readGraphicsControlExtension();
                        break;
                    case CONSTANT_FALG.commentExtension:
                        this.readCommentExtension();
                        break;
                    case CONSTANT_FALG.applicationExtension:
                        this.readApplicationExtension();
                        break;
                    case CONSTANT_FALG.plainTextExtension:
                        this.readPlainTextExtension();
                        break;
                    default:
                        break;
                }
                break;
            }
            case CONSTANT_FALG.imageDescriptor: {
                this.readImageDescriptor();
                break;
            }
            case CONSTANT_FALG.endFlag: {
                this.loaded = true;
                break;
            }
            default:
                break;
        }
    }

    /**
     * name
     */
    public readGraphicsControlExtension() {
        this.readOne(); // 跳过
        const m = this.readOne();


        const methodType = 0b111 & m >> 2;
        const useInputFlag = !!(0b1 & m >> 1);
        const transparentColorFlag = !!(0b1 & m);

        const delay = this.readOne() + (this.readOne() << 8);

        const transparentColorIndex = this.readOne();

        const frame = new Frame({
            methodType,
            useInputFlag,
            transparentColorFlag,
            delay,
            transparentColorIndex
        })
        this.frames.push(frame);
        this.readOne();
        this.readImageDescriptor(frame);
    }

    public readImageDescriptor(frame?: Frame) {
        if (!frame) {
            frame = new Frame({ methodType: 0, useInputFlag: false, transparentColorFlag: false, delay: 0 });
            this.frames.push(frame);
        }
        this.readOne() // 过滤标识

        frame.x = this.readOne() + (this.readOne() << 8);
        frame.y = this.readOne() + (this.readOne() << 8);
        frame.w = this.readOne() + (this.readOne() << 8);
        frame.h = this.readOne() + (this.readOne() << 8);

        const m = this.readOne();
        frame.isLocalColor = !!(0b1 & m >> 7);
        frame.isInterlace = !!(0b1 & m >> 6);
        frame.isSort = !!(0b1 & m >> 5);
        frame.sizeOfLocalColors = (0b111 & m);

        if (!frame.isLocalColor) {
            frame.globalColors = this.colors;
        }

        // 解析图像数据

        const colorDepth = this.readOne();
        const len = this.readOne();
        const data = this.read(len);
        const lzwDecode = new LzwDecode(colorDepth);
        frame.setImageData(lzwDecode.decode(data));

    }

    public readPlainTextExtension() {
        const len = this.readOne();
        this.read(len + 1); // 暂时不处理, 直接跳过
    }

    public readApplicationExtension() {
        const len = this.readOne();
        // TODO: 待完成
        this.read(len + 1);
    }

    public readCommentExtension() {
        const len = this.readOne();
        this.read(len + 1); // 暂时不处理, 直接跳过
    }
}
(window as any).LzwDecode = LzwDecode;