/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:17
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-17 01:18:07
 */
// FIXME: 没有实际测试过
export type Dictionary = Map<string | number, number>;

export default class LzwEncoder {
    constructor(width: number, height: number, colorDepth: number) {
        this.defaultColorSize = Math.max(1, colorDepth);
        this.buffers = new ArrayBuffer(width * height);
        this.dataView = new DataView(this.buffers);
        this.init();
    }

    defaultColorSize: number;

    colorSize!: number;

    dict!: Dictionary;

    clearCode!: number;

    endCode!: number;

    buffers: ArrayBuffer;

    dataView: DataView;

    remainingBits = 8;

    index = 0;

    init() {
        this.colorSize = this.defaultColorSize;
        this.dict = new Map<string, number>();
        for (let index = 0; index < 2 ** this.colorSize; index++) {
            this.insertSeq(index);
        }
        this.clearCode = 1 << this.colorSize;
        this.endCode = this.clearCode + 1;
        this.colorSize += 1;
        this.insertSeq('' + this.clearCode);
        this.insertSeq('' + this.endCode);
        this.pushCode(this.clearCode);
    }

    insertSeq(str: string | number) {
        const index = this.dict.size;
        if (index > (1 << this.colorSize)) {
            this.colorSize += 1;

            if (this.colorSize > 12) {
                this.init();
            }
        }
        this.dict.set(str, index);
    }

    getSeqCode(str: string) {
        return this.dict.get(str);
    }

    encode(str: number[]) {
        let current;
        let next;
        let code;
        let codes: number[] = [];

        let i = 0;
        while(i < str.length) {
            current = str[i];
            next = str[i + 1];
            while (next !== undefined && this.getSeqCode(`${current}${next}`) !== undefined) {
                current = `${current}${next}`;
                i += 1
                next = str[i + 1];
            }
            code = this.getSeqCode(current);
            if (next !== undefined) {
                this.insertSeq(`${current}${next}`);
            }
            this.pushCode(code);
            codes.push(code);

            i += 1;
        }
        this.pushCode(this.endCode);
        codes.push(this.endCode);
        return new Uint8Array(this.buffers).slice(0, this.index + 1);
    }

    pushCode(code: number) {
        const size = this.colorSize;
        this.dataView.setUint8(this.index, this.dataView.getUint8(this.index) | code << 8 - this.remainingBits);

        if (this.remainingBits <= size) {
            this.index += 1;
            this.dataView.setUint8(this.index, this.dataView.getUint8(this.index) | code >> this.remainingBits);
            this.remainingBits += 8;
        }
        this.remainingBits -= size;
    }
}
