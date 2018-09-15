/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 21:52:17
 * @Last Modified by:   lijianzhang
 * @Last Modified time: 2018-09-15 21:52:17
 */
import LzwEncode from  './lzw-encode';
import LzwDecode from './lzw-decode';

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
        this.readGlobalColorTable();
    }

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
     *
     * @type {({
     *         globalColorTableFlag: 0 | 1; // 如果其为 1 ，则表示存在 Global Color Table。如果为 0，则没有 Global Color Table
     *         colorResolution: number; // 用于表示色彩分辨率，如果为 s，则 Global Color Table 的颜色数为 2^(s+1)个，如果这是 s = 1,则一共有 4 中颜色，即每个像素可以用 2位（二进制） 来表示
     *         sortFlag: 0 | 1; // 它有两个值 0 或 1。如果为 0 则 Global Color Table 不进行排序，为 1 则表示 Global Color Table 按照降序排列，出现频率最多的颜色排在最前面。
     *         pixel: number; // 如其值为 s，则全局列表颜色个数的计算公式为 2^(s+1)。如 s = 1，则 Global Color Table 包含 4 个颜色
     *     })}
     * @memberof Gif
     */
    public packedField!: {
        globalColorTableFlag: 0 | 1; // 如果其为 1 ，则表示存在 Global Color Table。如果为 0，则没有 Global Color Table
        colorResolution: number; // 用于表示色彩分辨率，如果为 s，则 Global Color Table 的颜色数为 2^(s+1)个，如果这是 s = 1,则一共有 4 中颜色，即每个像素可以用 2位（二进制） 来表示
        sortFlag: 0 | 1; // 它有两个值 0 或 1。如果为 0 则 Global Color Table 不进行排序，为 1 则表示 Global Color Table 按照降序排列，出现频率最多的颜色排在最前面。
        sizeOfGlobalColorTable: number; // 如其值为 s，则全局列表颜色个数的计算公式为 2^(s+1)。如 s = 1，则 Global Color Table 包含 4 个颜色
    }

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


    version!: string;

    read(len = 1) {
        return this.dataSource.slice(this.offset, this.offset += len);
    }

    readOne() {
        return this.dataSource.slice(this.offset, this.offset += 1)[0];
    }

    public read1(l) {
        const b = this.read()
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
        console.log(w, h);
        this.width = w;
        this.height = h;
        const m = this.readOne();
        const globalColorTableFlag = (1 & m >> 7) as 0 | 1;

        const colorResolution = 0b0111 & m >> 4;

        const sortFlag = (1 & (m >> 3)) as 0 | 1;

        const sizeOfGlobalColorTable = (0b111 & m) as 0 | 1;

        this.packedField = {
            globalColorTableFlag,
            colorResolution,
            sortFlag,
            sizeOfGlobalColorTable
        }
        this.backgroundColorIndex = this.readOne();
        this.pixelAspectRatio = this.readOne();
    }

    private readGlobalColorTable() {
        const len =  2 ** (this.packedField.sizeOfGlobalColorTable + 1) * 3;
        let index = 0;
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
}

(window as any).LzwEncode = LzwEncode;

const a = new LzwEncode(10, 10, 2);
const b = a.encode([
    1,1,1,1,1,2,2,2,2,2,
    1,1,1,1,1,2,2,2,2,2,
    1,1,1,1,1,2,2,2,2,2,
    1,1,1,0,0,0,0,2,2,2,
    1,1,1,0,0,0,0,2,2,2,
    2,2,2,0,0,0,0,1,1,1,
    2,2,2,0,0,0,0,1,1,1,
    2,2,2,2,2,1,1,1,1,1,
    2,2,2,2,2,1,1,1,1,1,
    2,2,2,2,2,1,1,1,1,1,
]);
console.log(b);
console.log(Array.from(b).map(v => v.toString(2)));
(window as any).a = a;

const c = new LzwDecode(10, 2);
c.decode(b);