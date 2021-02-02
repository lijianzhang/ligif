/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-02 23:48:27
 */
import EncodeFrame from './frame/encode-Frame';


export type Dictionary = Map<string | number, number>;

class LzwDecode {
    constructor(colorDepth: number) {
        this.defaultColorSize = Math.max(2, colorDepth);
        this.init();
    }

    private defaultColorSize: number;

    private colorSize!: number;

    private dict!: Map<number, number[]>;

    private clearCode!: number;

    private endCode!: number;

    private buffers!: number[];

    private index = 0;

    private remainingBits = 8;

    private codes: number[] = [];

    public decode(buffers: number[]) {
        this.buffers = buffers;
        const outputs: number[] = [];
        let code: number = this.clearCode;
        let prevCode;

        while (true) {
            // tslint:disable-line
            prevCode = code;
            code = this.nextCode();
            if (code === this.endCode) break;

            if (code === this.clearCode) {
                this.init();
                continue;
            }

            if (code < this.dict.size) {
                if (prevCode !== this.clearCode) {
                    this.insertSeq(
                        this.getCodeSeq(prevCode).concat(
                            this.getCodeSeq(code)[0],
                        ),
                    );
                }
            } else {
                if (code !== this.dict.size) {
                    throw new Error('无效的图形数据');
                }

                const seq = this.getCodeSeq(prevCode);
                this.insertSeq(seq.concat(seq[0]));
            }
            outputs.push(...this.getCodeSeq(code));

            // 当字典长度等于颜色数的时候, 下个code占位数增加
            if (
                this.dict.size === 1 << this.colorSize &&
                this.colorSize < 12
            ) {
                this.colorSize += 1;
            }
        }

        return Uint8Array.from(outputs);
    }

    private init() {
        this.colorSize = this.defaultColorSize;
        this.dict = new Map();
        for (let index = 0; index < 2 ** this.colorSize; index += 1) {
            this.insertSeq([index]);
        }
        this.clearCode = 1 << this.colorSize;
        this.endCode = this.clearCode + 1;
        this.colorSize += 1;
        this.insertSeq([this.clearCode]);
        this.insertSeq([this.endCode]);
    }

    private insertSeq(str: number[]) {
        const index = this.dict.size;
        this.dict.set(index, str);
    }

    private getCodeSeq(code: number) {
        return this.dict.get(code)!;
    }

    private nextCode() {
        let colorSize = this.colorSize;
        let code = 0;
        let diff = 0;

        while (colorSize > 0 && this.buffers[this.index] !== undefined) {
            const buffer = this.buffers[this.index];
            const size = Math.min(colorSize, this.remainingBits);
            code =
                (((buffer >> (8 - this.remainingBits)) &
                    ((1 << size) - 1)) <<
                    diff) |
                code;
            colorSize -= this.remainingBits;
            this.remainingBits -= size;
            diff += size;
            if (this.remainingBits <= 0) {
                this.index += 1;
                this.remainingBits = (this.remainingBits % 8) + 8;
            }
        }
        this.codes.push(code);

        return code;
    }
}

function decodeToPixels(data: {
    imgData: number[];
    colorDepth: number;
    palette: number[];
    w: number;
    h: number;
    transparentColorIndex?: number;
    isInterlace?: boolean;
}) {
    const decode = new LzwDecode(data.colorDepth);
    const codes = decode.decode(data.imgData);
    const pixels = [];
    if (!data.isInterlace) {
        codes.forEach(k => {
            pixels.push(data.palette[k * 3]);
            pixels.push(data.palette[k * 3 + 1]);
            pixels.push(data.palette[k * 3 + 2]);
            pixels.push(k === data.transparentColorIndex ? 0 : 255);
        });
    } else {
        const start = [0, 4, 2, 1];
        const inc = [8, 8, 4, 2];
        let index = 0;
        for (let pass = 0; pass < 4; pass += 1) {
            // from https://juejin.im/entry/59cc6fa151882550b3549bce
            for (let i = start[pass]; i < data.h; i += inc[pass]) {
                for (let j = 0; j < data.w; j += 1) {
                    const idx = (i - 1) * data.w * 4 + j * 4;
                    const k = codes[index];
                    pixels[idx] = data.palette[k * 3];
                    pixels[idx + 1] = data.palette[k * 3 + 1];
                    pixels[idx + 2] = data.palette[k * 3 + 2];
                    pixels[idx + 3] =
                        k === data.transparentColorIndex ? 0 : 255;
                    index += 1;
                }
            }
        }
    }

    return pixels;
}



class LzwEncoder {
    constructor(width: number, height: number, colorDepth: number) {
        this.defaultColorSize = Math.max(2, colorDepth);
        this.buffers = new Uint8Array(width * height + 100);
        this.init();
    }

    public defaultColorSize: number;

    public colorSize!: number;

    public dict: Dictionary = new Map<string, number>();
    public dict2: Dictionary = new Map<string, number>();

    public clearCode!: number;

    public endCode!: number;

    public buffers: Uint8Array;

    public remainingBits = 8;

    public index = 0;

    public codes: number[] = [];

    public init() {
        this.colorSize = this.defaultColorSize + 1;
        this.dict.clear();
        for (
            let index = 0;
            index < 2 ** this.defaultColorSize;
            index += 1
        ) {
            this.insertSeq(index);
        }
        this.clearCode = 1 << this.defaultColorSize;
        this.endCode = this.clearCode + 1;
        this.insertSeq(this.clearCode);
        this.insertSeq(this.endCode);
    }

    public insertSeq(str: string | number) {
        const index = this.dict.size;
        this.dict.set(str, index);
        this.dict2.set(str, index);
    }

    public getSeqCode(str: string | number) {
        return this.dict.get(str);
    }

    public encode(str: Uint8Array) {
        let prefixCode: string | number = '';

        let i = 0;
        this.pushCode(this.clearCode);
        while (i < str.length) {
            if (this.dict.size === 4097) {
                this.pushCode(this.clearCode);
                this.init();
            } else if (this.dict.size === (1 << this.colorSize) + 1) {
                this.colorSize += 1;
            }
            const currentCode = str[i];
            const key =
                prefixCode !== ''
                    ? `${prefixCode},${currentCode}`
                    : currentCode;

            if (
                this.getSeqCode(key) !== undefined &&
                str[i + 1] !== undefined
            ) {
                prefixCode = key;
            } else {
                this.insertSeq(key);
                this.pushCode(this.getSeqCode(prefixCode));
                prefixCode = currentCode;
            }
            i += 1;
        }
        this.pushCode(this.getSeqCode(prefixCode));
        this.pushCode(this.endCode);

        return this.buffers.slice(0, this.index + 1);
    }

    public pushCode(code: number) {
        this.codes.push(code);
        let colorSize = this.colorSize;
        let data = code;

        while (colorSize >= 0) {
            const size = Math.min(colorSize, this.remainingBits);
            const c =
                this.buffers[this.index] |
                ((data << (8 - this.remainingBits)) & 255);
            this.buffers[this.index] = c;
            data >>= size;
            colorSize -= this.remainingBits;
            this.remainingBits -= size;
            if (this.remainingBits <= 0) {
                this.index += 1;
                this.remainingBits = (this.remainingBits % 8) + 8;
            }
        }
    }
}


/*
 * @Author: lijianzhang
 * @Date: 2018-10-08 14:33:26
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-02 21:43:32
 */

function optimizePixels(frames: EncodeFrame[], width: number, maxDiff: number = 30) {
    const lastPixels = [];

    /**
     * 计算色差
     * from: https://blog.csdn.net/jaych/article/details/51137341?utm_source=cop
     */
    function colourDistance(
        rgb1: [number, number, number],
        rgb2: [number, number, number],
    ) {
        const rmean = (rgb1[0] + rgb2[0]) / 2;
        const r = rgb1[0] - rgb2[0];
        const g = rgb1[1] - rgb2[1];
        const b = rgb1[2] - rgb2[2];

        return Math.sqrt(
            (((rmean + 512) * r * r) >> 8) +
            g * g * 4 +
            (((767 - rmean) * b * b) >> 8),
        );
    }

    return frames.map(frame => {
        // tslint:disable-line
        const paletteMap = new Map();
        const palette: number[] = [];
        let x = frame.x;
        let y = frame.y;
        let w = frame.w;
        let h = frame.h;
        const pixels = frame.pixels;

        let newPixels: number[] = [];

        // let alphaList: number[] = [];
        let startNum = 0; // 表示从0开始连续的透明像素的数目
        let isDone = false;
        let endNum = 0; // 表示连续的且到最后的透明像素的数目
        let startOffset = 0;
        let maxStartOffset = w; // 左边空白像素
        let maxEndOffset = w; // 右边空白像素
        let transparencCount = 0;

        for (let index = 0; index < pixels.length; index += 4) {
            const offset =
                (y + Math.floor(index / (w * 4))) * width * 4 +
                ((index % (w * 4)) / 4 + x) * 4;
            const r1 = pixels[index];
            const r2 = lastPixels[offset];
            const g1 = pixels[index + 1];
            const g2 = lastPixels[offset + 1];
            const b1 = pixels[index + 2];
            const b2 = lastPixels[offset + 2];
            const a = pixels[index + 3];

            if ((index / 4) % w === 0) {
                startOffset = 0;
            }

            const diff = colourDistance([r1, g1, b1], [r2, g2, b2]);
            if (diff < maxDiff || a === 0) {
                if (a === 0) {
                    newPixels.push(0, 0, 0, 0);
                } else {
                    newPixels.push(r1, g1, b1, 0);
                }
                transparencCount += 1;

                if (!isDone) {
                    startNum += 1;
                }
                startOffset += 1;
                endNum += 1;
            } else {
                const c = `${r1},${g1},${b1}`;
                if (!paletteMap.has(c)) {
                    palette.push(r1, g1, b1);
                    paletteMap.set(c, true);
                }
                newPixels.push(r1, g1, b1, a);
                lastPixels[offset] = r1;
                lastPixels[offset + 1] = g1;
                lastPixels[offset + 2] = b1;
                lastPixels[offset + 3] = a;
                if (!isDone) isDone = true;
                maxStartOffset =
                    startOffset < maxStartOffset
                        ? startOffset
                        : maxStartOffset;
                endNum = 0;
            }
            if (maxEndOffset !== 0 && (index / 4 + 1) % w === 0) {
                const endOffset = endNum % w;
                maxEndOffset =
                    endOffset < maxEndOffset ? endOffset : maxEndOffset;
            }
        }
        transparencCount -= startNum + endNum;
        const top = Math.floor(startNum / w);
        let start = 0;
        let end = pixels.length;

        if (top) {
            start = top * w * 4;
            y += top;
            h -= top;
        }

        const bottom = Math.floor(endNum / w);
        if (bottom) {
            end -= bottom * w * 4;
            h -= bottom;
        }
        newPixels = newPixels.slice(start, end);

        if (maxEndOffset || maxStartOffset) {
            newPixels = newPixels.filter((_, i) => {
                const range = Math.floor(i / 4) % w;
                if (range < maxStartOffset || range >= w - maxEndOffset) {
                    return false;
                }

                return true;
            });
            x += maxStartOffset;
            w -= maxStartOffset + maxEndOffset;
        }

        return {
            newPixels,
            x,
            y,
            w,
            h,
            palette,
            transparencCount,
            paletteMap,
        };
    });
}

self.onmessage = (e) => {
    const { name, ...other } = e.data;
    if (name === 'encode') {
        const encoder = new LzwEncoder(other.width, other.height, other.colorDepth);
        self.postMessage(encoder.encode(other.codes));
    } else if (name === 'decodeToPixels') {
        self.postMessage(decodeToPixels(other));
    } else if (name === 'optimizePixels') {
        self.postMessage(optimizePixels(e.data.frames, e.data.width, e.data.maxDiff));
    }
};
