/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-18 23:53:38
 */

export type Dictionary = Map<string | number, number>;

export default class LzwEncoder {
    constructor(width: number, height: number, colorDepth: number) {
        this.defaultColorSize = Math.max(2, colorDepth);
        this.buffers = new ArrayBuffer(width * height + 100);
        this.dataView = new DataView(this.buffers);
        this.init();
    }

    defaultColorSize: number;

    colorSize!: number;

    dict: Dictionary = new Map<string, number>();

    clearCode!: number;

    endCode!: number;

    buffers: ArrayBuffer;

    dataView: DataView;

    remainingBits = 8;

    index = 0;

    codes: number[] = [];

    init() {
        this.colorSize = this.defaultColorSize + 1;
        this.dict.clear();
        for (let index = 0; index < 2 ** this.defaultColorSize; index++) {
            this.insertSeq(index);
        }
        this.clearCode = 1 << this.defaultColorSize;
        this.endCode = this.clearCode + 1;
        this.insertSeq(this.clearCode);
        this.insertSeq(this.endCode);
    }

    insertSeq(str: string | number) {
        const index = this.dict.size;
        this.dict.set(str, index);
    }

    getSeqCode(str: string) {
        return this.dict.get(str);
    }

    encode(str: number[]) {
        let current;
        let next;
        let code;

        let i = 0;
        this.pushCode(this.clearCode);
        while(i < str.length) {
            current = str[i];
            next = str[i + 1];
            if (this.dict.size == 4096) {
                this.pushCode(this.clearCode);
                this.init();
            }  else if (this.dict.size === (1 << this.colorSize)) {
                this.colorSize += 1;
            }
            while (next !== undefined && this.getSeqCode(`${current},${next}`) !== undefined) {
                current = `${current},${next}`;
                i += 1
                next = str[i + 1];
            }
            
            code = this.getSeqCode(current);
            if (next !== undefined) {
                this.insertSeq(`${current},${next}`);   
            }
            this.pushCode(code);
            i += 1;

        }
        this.pushCode(this.endCode);

        return new Uint8Array(this.buffers).slice(0, this.index + 1);
    }

    pushCode(code: number) {
        this.codes.push(code);
        let colorSize = this.colorSize;
        let data = code;

        while (colorSize >= 0) {
            const size = Math.min(colorSize, this.remainingBits);
            const c = this.dataView.getUint8(this.index) | data << (8 - this.remainingBits) & 255;
            this.dataView.setUint8(this.index, c);
            data >>= size;
            colorSize -= this.remainingBits;
            this.remainingBits -= size;
            if (this.remainingBits <= 0) {
                this.index += 1;
                this.remainingBits = this.remainingBits % 8 + 8;
            }
        }
    }
}
