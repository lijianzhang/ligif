
/*
 * @Author: lijianzhang
 * @Date: 2018-09-15 19:40:20
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-15 21:44:57
 */

 export default class LzwDecode {
    constructor(width: number, colorDepth: number) {
        this.width = width;
        this.defaultColorSize = Math.max(1, colorDepth);
        this.init();
    }

    defaultColorSize: number;

    colorSize!: number;

    width: number;

    dict!: Map<number, string>;

    clearCode!: number;

    endCode!: number;

    buffers: Uint8Array = new Uint8Array();

    data: number[] = [];

    init() {
        this.colorSize = this.defaultColorSize;
        this.dict = new Map();
        for (let index = 0; index < 2 ** this.colorSize; index++) {
            this.insertSeq('' + index);
        }
        this.clearCode = 1 << this.colorSize;
        this.endCode = this.clearCode + 1;
        this.colorSize += 1;
        this.insertSeq('' + this.clearCode);
        this.insertSeq('' + this.endCode);
    }

    insertSeq(str: string) {
        const index = this.dict.size;
        if (index > ((1 << this.colorSize)) - 1) {
            this.colorSize += 1;
        }
        this.dict.set(index, str);
    }

    getCodeSeq(code: number) {
        return this.dict.get(code)!;
    }

    index = 0;

    remainingBits = 8;

    codes: number[] = [];

    nextCode() {
        const size = this.colorSize;
        let buffer = this.buffers[this.index];
        if (buffer === undefined) return null;
        const diff = 8 - this.remainingBits;
        let code = (buffer >> diff) & (1 << (size)) - 1;
        if (this.remainingBits <= size) {
            this.index += 1;
            buffer = this.buffers[this.index];
            if (!buffer) throw new Error('图片缺失数据');
            code = ((buffer & ((1 << (size - this.remainingBits)) - 1)) << this.remainingBits) | code;
            this.remainingBits += 8;
        }
        this.remainingBits -= size
        this.codes.push(code);
        return code;
    }

    decode(buffers: Uint8Array) {
        this.buffers = buffers;
        let prev;
        let isDone = false;
        this.nextCode();
        
        while (!isDone) {
            let code = this.nextCode();
            if (code === this.clearCode) {
                this.colorSize += 1;
                code = this.nextCode();
            }

            if (code === this.endCode || code === null) {
                isDone = true;
            } else {
                let output = this.getCodeSeq(code);
                prev = output;
                output = this.getCodeSeq(code);
                this.insertSeq(`${prev}${output[0]}`);
                this.data.push(code);
            }
        }
        return this.data;
    }
 }