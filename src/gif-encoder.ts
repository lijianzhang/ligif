import Frame from './frame';
import NeuQuant from './neuquant.js';
import LzwEncoder from './lzw-encode';
export default class GIFEncoder {
    frames: Frame[] = [];

    public codes: number[] = [];

    addFrame(frame: Frame) {
        this.frames.push(frame);
    }

    generate(samplefac?: number, colorDepth?: number) {
        this.writeFlag();
        this.generatePalette(this.frames, samplefac, colorDepth);
        this.writeLogicalScreenDescriptor();
        this.wirteFrames();
        this.addCode(0x3b);
    }

    private strTocode(str: string) {
        return str.split('').map(s => s.charCodeAt(0));
    }

    private numberToBytes(num: number) {
        const d = num - 255;
        if (d > 0) {
            return [255, d];
        }
        return [num, 0];
    }

    addCodes(codes: number[]) {
        this.codes.push(...codes);
    }
    addCode(code: number) {
        this.codes.push(code);
    }

    writeFlag() {
        if (this.frames.length < 1) throw new Error('缺少图片');
        this.addCodes(this.strTocode('GIF89a'));
    }

    neuQuant?: NeuQuant;

    palette?: number[] = [];

    colorDepth: number = 7;

    generatePalette(frames: Frame[], samplefac: number = 10, colorDepth = 7) {
        this.colorDepth = colorDepth;
        const pixels = frames.reduce(
            (arr, frame) => arr.concat(this.getFramePixels(frame)),
            [] as number[],
        );
        this.neuQuant = new NeuQuant(pixels, { netsize: 1 << colorDepth, samplefac });
        this.neuQuant.buildColorMap();
        this.palette = this.neuQuant.getColorMap();
    }

    getFramePixels(frame: Frame) {
        const w = frame.w;
        const h = frame.h;
        const data = frame.pixels;
        const pixels = new Array(w * h * 3);

        let srcPos = 0;
        let count = 0;

        for (var i = 0; i < h; i++) {
            for (var j = 0; j < w; j++) {
                pixels[count++] = data[srcPos++];
                pixels[count++] = data[srcPos++];
                pixels[count++] = data[srcPos++];
                srcPos++;
            }
        }
        console.log(pixels);
        return pixels;
    }

    /**
     * TODO: 计算颜色等, 待完成 暂时写死
     *
     * @private
     * @memberof GIFEncoder
     */
    private writeLogicalScreenDescriptor() {
        const { w, h } = this.frames[0];
        this.addCodes(this.numberToBytes(w));
        this.addCodes(this.numberToBytes(h));

        let m = 1 << 7; // globalColorTableFlag
        m += 0 << 4; // colorResolution
        m += 0 << 3; // sortFlag
        m += this.colorDepth - 1; // sizeOfGlobalColorTable

        this.addCode(m);
        this.addCode(255); // backgroundColorIndex
        this.addCode(255); // pixelAspectRatio
        this.addCodes(this.palette!);
    }

    findClosest(r: number, g: number, b: number) {
        if (!this.palette) throw new Error('缺少颜色');
        let minpos = 0;
        let mind = 256 * 256 * 256;

        for (let i = 0, l = this.palette.length; i < l; ) {
            const dr = r - this.palette[i++];
            const dg = g - this.palette[i++];
            const db = b - this.palette[i];
            const d = dr * dr + dg * dg + db * db;
            const pos = (i / 3) | 0;

            if (d < mind) {
                mind = d;
                minpos = pos;
            }

            i++;
        }

        return minpos;
    }

    wirteFrames() {
        this.frames.forEach(frame => {
            // 1. Graphics Control Extension
            this.addCode(0x21); // exc flag
            this.addCode(0xf9); // al
            this.addCode(4); // byte size
            let m = 0;
            m += frame.displayType << 3; // sortFlag
            m += +frame.useInput << 1;
            m += frame.transparentColorIndex ? 1 : 0;
            this.addCode(m);
            this.addCodes(this.numberToBytes(frame.delay));
            this.addCode(frame.transparentColorIndex || 0);
            this.addCode(0);

            // 2. mage Descriptor
            this.addCode(0x2c);
            this.addCodes(this.numberToBytes(frame.x));
            this.addCodes(this.numberToBytes(frame.y));
            this.addCodes(this.numberToBytes(frame.w));
            this.addCodes(this.numberToBytes(frame.h));

            m = 0;
            m += +frame.isInterlace << 6;
            m += +frame.sort << 5;
            this.addCode(m);

            // Image Data
            this.addCode(2);

            const indexs: number[] = [];
            for (let i = 0; i < frame.pixels.length; i += 4) {
            const r = frame.pixels[i];
                const g = frame.pixels[i + 1];
                const b = frame.pixels[i + 2];
                indexs.push(this.findClosest(r, g, b));
            }

            const encoder = new LzwEncoder(frame.w, frame.h, this.colorDepth);
            const codes = Array.from(encoder.encode(indexs));
            console.log(codes);
            let len = codes.length;
            while (len > 0) {
                this.addCode(Math.min(len, 255));
                this.addCodes(codes.splice(0, 255));
                len -= 255;
            }
            this.addCode(0);
        });
    }
}
