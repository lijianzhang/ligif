/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 21:52:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-17 15:42:40
 */
import Frame, { IFrameOpiton } from './frame';

const CONSTANT_FALG = {
    imageDescriptor: 0x2C, //44
    extension: 0x21, // 33
    imageExtension: 0xF9, // 249
    plainTextExtension: 0x01, // 1
    applicationExtension: 0xFF, // 255
    commentExtension: 0xFE, // 254
    endFlag: 0x3B, // 59
};
export default class Gif {
    constructor(data?: Blob) {
        if (data) {
            this.fieldReader = new FileReader();
            this.fieldReader.readAsArrayBuffer(data);
            this.fieldReader.onload = this.onLoad.bind(this);
        }
        (window as any).gif = this;
    }

    async readData(data: Blob) {
        this.fieldReader = new FileReader();
        this.fieldReader.readAsArrayBuffer(data);
        return new Promise(res => {
            this.fieldReader.onload = () => {
                this.onLoad();
                res(this);
            }
        }) as Promise<this>;
    }

    private fieldReader!: FileReader;

    private dataSource!: Uint8Array;

    private currentOptions?: IFrameOpiton;

    private onLoad() {
        this.dataSource = new Uint8Array(this.fieldReader.result as ArrayBuffer);
        this.readHeader();
        this.readLogicalScreenDescriptor();

        if (this.globalColorTableFlag) {
            const len =  2 ** (this.sizeOfGlobalColorTable + 1) * 3;
            this.palette = this.readColorTable(len);
        }

        while (!this.loaded) {
            this.readExtension();
        }
        if (this.next) this.next(this);
    }

    next?(gif: this);

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

    appVersion?: string;


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

    palette: number[] = [];

    loaded = false;

    commit?: string;

    /**
     *循环播放次数
     *
     * @type {number}
     * @memberof Gif
     */
    times?: number;


    version!: string;

    private read(len = 1) {
        return this.dataSource.slice(this.offset, this.offset += len);
    }

    private readOne() {
        return this.dataSource.slice(this.offset, this.offset += 1)[0];
    }

    private getDataType() {
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

        this.sizeOfGlobalColorTable = 0b0111 & m;

        this.sortFlag = !!(1 & (m >> 3));

        this.colorResolution = (0b111 & m >> 4);

        this.backgroundColorIndex = this.readOne();
        this.pixelAspectRatio = this.readOne();
    }

    private readColorTable(len: number) {
        const palette: number[] = [];
        let index = 3;
        while (index <= len) {
            // TODO: 看看有没有更好的写法
            let rpg = this.read(3);
            palette.push(rpg[0]);
            palette.push(rpg[1]);
            palette.push(rpg[2]);
            index += 3;
        };
        return palette;
    }

    private readExtension() {
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
            case 0:
                break;
            default:
                throw new Error('错误的格式');
                break;
        }
    }

    /**
     * name
     */
    private readGraphicsControlExtension() {
        
        this.readOne(); // 跳过
        const m = this.readOne();


        const displayType = 0b111 & m >> 2;
        const useInput = !!(0b1 & m >> 1);
        const transparentColorFlag = !!(m & 0b1);
        const delay = this.readOne() + (this.readOne() << 8);

        const transparentColorIndex = this.readOne();

        this.currentOptions = {
            displayType,
            useInput,
            delay,
            transparentColorIndex: transparentColorFlag ? transparentColorIndex : undefined
        };
        this.readOne();
    }

    private readImageDescriptor() {
        
        const option = this.currentOptions || {};

        const frame = new Frame(option);
        frame.prevFrame = this.frames[this.frames.length - 1];
        this.frames.push(frame);
        this.currentOptions = undefined;


        frame.x = this.readOne() + (this.readOne() << 8);
        frame.y = this.readOne() + (this.readOne() << 8);
        frame.w = this.readOne() + (this.readOne() << 8);
        frame.h = this.readOne() + (this.readOne() << 8);

        const m = this.readOne();
        const isLocalColor = !!(0b1 & m >> 7);
        frame.isInterlace = !!(0b1 & m >> 6);
        if (isLocalColor) {
            debugger;
        }
        frame.sort = !!(0b1 & m >> 5);
        const colorSize = (0b111 & m);

        if (isLocalColor) {
            const len =  2 ** (colorSize + 1) * 3;
            frame.palette = this.readColorTable(len);
        } else {
            frame.palette = this.palette;
        }

        // 解析图像数据

        frame.colorDepth = this.readOne();
        let data: number[] = []
        while (true) {
            let len = this.readOne();
            if (len) {
                this.read(len).forEach(v => data.push(v));
            } else {
                frame.bytes = data.slice();
                break;
            }
        }


    }

    private readPlainTextExtension() {
        
        const len = this.readOne();
        this.read(len); // TODO: 暂时不处理, 直接跳过
    }

    
    private readApplicationExtension() {
        
        let len = this.readOne();
        if (len !== 11) throw new Error('解析失败: application extension is invalid data');

        const arr = this.read(len);
        this.appVersion = arr.reduce((s, c) => s + String.fromCharCode(c), '');
        const le = this.readOne();
        this.readOne();
        this.times = this.readOne();
        
        while (this.getDataType()) {
            this.readOne();
        }
    }

    private readCommentExtension() {
        
        const len = this.readOne();
        const arr = this.read(len + 1); // TODO: 暂时不处理, 直接跳过
        this.commit = arr.reduce((s, c) => s + String.fromCharCode(c), '');
    }
}