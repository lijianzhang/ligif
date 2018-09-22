
/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:20
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-22 09:40:35
 */
import workPool from './work';

workPool.registerWork('decode', (colorDepth: number, buffer: number[] | Uint8Array) => {
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
    
        private buffers!: Uint8Array | number[];
    
        private init() {
            this.colorSize = this.defaultColorSize;
            this.dict = new Map();
            for (let index = 0; index < 2 ** this.colorSize; index++) {
                this.insertSeq([index]);
            }
            this.clearCode = 1 << this.colorSize;
            this.endCode = this.clearCode + 1;
            this.colorSize += 1;
            this.insertSeq([]);
            this.insertSeq([]);
        }
    
        private insertSeq(str: number[]) {
            const index = this.dict.size;
            
            this.dict.set(index, str);
        }
    
        private getCodeSeq(code: number) {
            return this.dict.get(code)!;
        }
    
        private index = 0;
    
        private remainingBits = 8;
    
        private codes: number[] = [];
    
        private nextCode() {
            let colorSize = this.colorSize;
            let code = 0;
            let diff = 0;
    
            while (colorSize > 0) {
                const buffer = this.buffers[this.index];
                if (buffer === undefined) {
                    throw new Error('图片缺失数据')
                };
                const size = Math.min(colorSize, this.remainingBits);
                code = ((buffer >> (8 - this.remainingBits) & (1 << size) - 1) << (diff)) | code;
                colorSize -= this.remainingBits;
                this.remainingBits -= size;
                diff += size;
                if (this.remainingBits <= 0) {
                    this.index += 1;
                    this.remainingBits = this.remainingBits % 8 + 8;
                }
            }
            this.codes.push(code);
            return code;
        }
    
        decode(buffers: Uint8Array | number[]) {
            this.buffers = buffers;
            const outputs: number[] = [];
            let code: number = this.clearCode;
            let prevCode;
    
            while (true) {
                prevCode = code;
                code = this.nextCode();
                if (code == this.endCode) break;
    
                if (code == this.clearCode) {
                    this.init();
                    continue;
                }
    
                if (code < this.dict.size) {
                    if (prevCode !== this.clearCode) {
                        this.insertSeq(this.getCodeSeq(prevCode).concat(this.getCodeSeq(code)[0]));
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
                if (this.dict.size === (1 << this.colorSize) && this.colorSize < 12) {
                    this.colorSize += 1;
                }
            }
    
            return outputs;
        }
     }
     const decode = new LzwDecode(colorDepth);
     return decode.decode(buffer);
})