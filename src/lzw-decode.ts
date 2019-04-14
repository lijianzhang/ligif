/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2019-04-14 20:21:32
 */

import workPool from './work-pool';
export type Dictionary = Map<string | number, number>;

workPool.registerWork('decode', data => {
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

    return decodeToPixels(data);
});
