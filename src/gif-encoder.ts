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
        this.generatePalette(samplefac, colorDepth);
        this.writeLogicalScreenDescriptor();
        this.wirteFrames();
        this.addCode(0x3b);
    }

    private strTocode(str: string) {
        return str.split('').map(s => s.charCodeAt(0));
    }

    private numberToBytes(num: number) {
        return [num & 255, num >> 8];
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

    /**
     * 调色板
     */
    palette?: number[] = [];

    /**
     * 颜色深度
     */
    colorDepth: number = 7;

    transparencIndex?: number;

    imgDatas: number[][] = [];

    colorMap: Map<string, number> = new Map();

    generatePalette(samplefac: number = 10, colorDepth: number = 7) {
        const imgDatas = this.getFrameImageDatas(this.frames);
        this.imgDatas =imgDatas;
        const pixels = this.getTotalPixels(imgDatas);
        const maxColorDepth = Math.ceil(Math.log2(pixels.length / 3));

        this.colorDepth = Math.min(colorDepth, maxColorDepth);

        if (pixels.length / 3 > 254) {
            this.neuQuant = new NeuQuant(pixels, { netsize: 1 << (this.colorDepth) - 1, samplefac }); // 减1保留透明色位置
            this.neuQuant.buildColorMap();
            this.palette = Array.from(this.neuQuant.getColorMap());
        } else {
            if (this.transparencIndex !== undefined && pixels.length / 3 === 1 << maxColorDepth) {
                this.colorDepth += 1;
            }
            this.palette = pixels;
        }

        if (this.transparencIndex !== undefined) {
            const index = this.palette!.length;
            this.transparencIndex = index / 3;
            this.palette!.push(...[0, 0, 0]);
        }

        while (this.palette!.length < (1 << this.colorDepth) * 3) {
            this.palette!.push(0, 0, 0);
        }
    }

    getTotalPixels(frames: number[][]) {
        let i = 0;
        return frames.reduce((pixels, frame) => {
            for (let index = 0; index < frame.length; index += 4) {
                const r = frame[index];
                const g = frame[index + 1];
                const b = frame[index + 2];
                const a = frame[index + 3];

                const c = a === 0 ? 'a' : `${r},${g},${b}`;

                if (a === 0) { //获取透明颜色索引
                    this.transparencIndex = i;
                }

                if (!this.colorMap.has(c)) {
                    pixels.push(r,g,b);
                    this.colorMap.set(c, i);
                    i += 1;
                }
            }
            return pixels;
        }, [] as number[]);
    }

    getFrameImageDatas(frames: Frame[]) {
        const [fistFrame, ...otherFrams] = frames;
        let lastImageData = [...fistFrame.pixels];
        let frameImageDatas = [[...fistFrame.pixels]];

        otherFrams.forEach((frame, i) => {
            frameImageDatas[i + 1] = [];
            const data = frameImageDatas[i + 1];
            for (let index = 0; index < frame.pixels.length; index += 4) {
                const r1 = lastImageData[index];
                const r2 = frame.pixels[index];
                const g1 = lastImageData[index + 1];
                const g2 = frame.pixels[index + 1];
                const b1 = lastImageData[index + 2];
                const b2 = frame.pixels[index + 2];
                const a = frame.pixels[index + 3];
                if (r1 === r2 && g1 === g2 && b1 === b2) {
                    data.push(0, 0, 0, 0);
                }  else {
                    data.push(r1, g1, b1, a);
                    lastImageData[index] = r1;
                    lastImageData[index + 1] = g1;
                    lastImageData[index + 2] = b1;
                    lastImageData[index + 3] = a;
                }
            }
        });
        return frameImageDatas;
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
        m += Math.log2(this.palette!.length / 3) - 1; // sizeOfGlobalColorTable
        this.addCode(m);
        this.addCode(0); // backgroundColorIndex
        this.addCode(255); // pixelAspectRatio
        this.addCodes(this.palette!);
    }

    findClosest(r: number, g: number, b: number) {
        if (!this.palette) throw new Error('缺少颜色');
        if (this.neuQuant) {
            let minpos = 0;
            let mind = 256 * 256 * 256;

            for (let i = 0; i < this.palette.length; i += 3) {
                const dr = r - this.palette[i];
                const dg = g - this.palette[i + 1];
                const db = b - this.palette[i + 2];
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
        const c = `${r},${g},${b}`;
        return this.colorMap.get(c)!;
    }

    wirteFrames() {
        this.frames.forEach((frame, fIndex) => {
            // 1. Graphics Control Extension
            this.addCode(0x21); // exc flag
            this.addCode(0xf9); // al
            this.addCode(4); // byte size
            let m = 0;
            m += 1 << 2; // sortFlag
            m += +frame.useInput << 1;
            m += this.transparencIndex !== undefined ? 1 : 0;
            this.addCode(m);
            this.addCodes(this.numberToBytes(frame.delay));
            this.addCode(this.transparencIndex || 0);
            this.addCode(0);

            // 2. image Descriptor
            this.addCode(0x2c);
            this.addCodes(this.numberToBytes(0)); //TODO: 需要改为frame的位置, 下同
            this.addCodes(this.numberToBytes(0));
            this.addCodes(this.numberToBytes(this.frames[0].w));
            this.addCodes(this.numberToBytes(this.frames[0].h));

            m = 0;
            m += +frame.isInterlace << 6;
            m += +frame.sort << 5;
            this.addCode(m);

            // Image Data
            this.addCode(this.colorDepth);
            
            const indexs: number[] = [];
            const imageData = this.imgDatas[fIndex];

            for (let i = 0; i < imageData.length; i += 4) {
                if (imageData[i + 3] === 0) {

                    indexs.push(this.transparencIndex!);
                } else {
                    const r = frame.pixels[i];
                    const g = frame.pixels[i + 1];
                    const b = frame.pixels[i + 2];
                    indexs.push(this.findClosest(r, g, b));
                }
            }

            const encoder = new LzwEncoder(frame.w, frame.h, this.colorDepth);
            const codes = Array.from(encoder.encode(indexs));

            let len = codes.length;
            while (len > 0) {
                this.addCode(Math.min(len, 0xFF));
                this.addCodes(codes.splice(0, 0xFF));
                len -= 255;
            }
            this.addCode(0);
        });
    }
}
