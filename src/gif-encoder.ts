import Frame, { IFrame } from './frame';
import NeuQuant from './neuquant.js';
import './lzw-encode';
import workPool from './work';

const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));

export default class GIFEncoder {
    private frames: Frame[] = [];

    public codes: number[] = [];

    addFrame(frame: IFrame) {
        const preFrame = this.frames[this.frames.length - 1];
        if (frame instanceof Frame) {
            frame = frame.toData();
        }
        const f = new Frame(frame);
        f.prevFrame = preFrame;
        this.frames.push(f);
    }

    addFrames(frames: Frame[]) {
        frames.forEach(frame => this.addFrame(frame));
    }

    async generate(samplefac?: number, colorDepth?: number) {
        console.group('generate gif')
        console.time('generate time')
        this.writeFlag();
        await this.generatePalette(samplefac, colorDepth);
        this.writeLogicalScreenDescriptor();
        this.writeApplicationExtension();
        console.time('wirteFrames');
        await this.wirteFrames();
        console.timeEnd('wirteFrames');
        this.addCode(0x3b);
        console.timeEnd('generate time')
        console.groupEnd()

    }

    private strTocode(str: string) {
        return str.split('').map(s => s.charCodeAt(0));
    }

    private numberToBytes(num: number) {
        return [num & 255, num >> 8];
    }

    addCodes(codes: number[]) {
        this.codes = this.codes.concat(codes);
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
    palette: number[] = [];

    /**
     * 颜色深度
     */
    colorDepth: number = 8;

    transparencIndex?: number;

    colorMap: Map<string, number> = new Map();

    /**
     * 生成全局的调色板
     *
     * @param {number} [samplefac=10]
     * @param {number} [colorDepth=8]
     * @memberof GIFEncoder
     */
    async generatePalette(samplefac: number = 10, colorDepth: number = 8) {
        console.time('generateFrameImageDatas');
        workPool.registerWork('generateImageDatas', this.generateImageDatas);
        await workPool.executeWork('generateImageDatas', [this.frames]);
        console.timeEnd('generateFrameImageDatas');

        console.time('parseFramePixels');
        this.frames.forEach(f => this.parseFramePixels(f));
        console.timeEnd('parseFramePixels');

        if (this.palette.length) {
            const maxColorDepth = Math.ceil(Math.log2(this.palette.length / 3));
            this.colorDepth = Math.min(colorDepth, maxColorDepth);
        } else {
            this.colorDepth = 0;
        }
    }

    hasTransparenc = false;

    // 局部颜色板索引map
    localColorMap: Map<Frame, Map<string, number>> = new Map();

    /**
     * 解析帧的图像: 配置帧图像的颜色和透明数据
     * TODO: 只用全局调色板不一定生成的gif体积就小, 尤其在颜色深度比较小的 gif 比较明显;
     *      因为颜色深度变大后, image data 占据的位数也会变大, 所以还要看像素使用的频率, 
     * 1. 或者改为,首先生成全部局部颜色, 再做对比, 根据颜色使用频率生成全局颜色板 (感觉比较困难, 和影响性能)
     * 2. 或者改为,当颜色深度超过某一值得时候不再增加?
     * @memberof GIFEncoder
     */
    parseFramePixels(frame: Frame) {
        const colorMap = new Map(this.colorMap);
        const localColorMap = new Map();
        let rgbPixels: number[] = [];
        let globalRgbPixels: number[] = [];
        let hasTransparenc = false;

        for (let index = 0; index < frame.pixels.length; index += 4) {
            const r = frame.pixels[index];
            const g = frame.pixels[index + 1];
            const b = frame.pixels[index + 2];
            const a = frame.pixels[index + 3];
            
            if (a === 0) {
                hasTransparenc = true;
            } else {
                const c = `${r},${g},${b}`;
                if (!localColorMap.has(c)) { // XXX: 待优化
                    const size = localColorMap.size;
                    localColorMap.set(c, size);
                    rgbPixels.push(r,g,b);
                    if (!colorMap.has(c)) {
                        const size = colorMap.size;
                        colorMap.set(c, size);
                        globalRgbPixels.push(r,g,b);
                    }
                }
            }
        }

        // 图像颜色数目超过256个需要减图片质量
        if ((localColorMap.size + (hasTransparenc ? 1: 0)) > 256) { 
            const nq = new NeuQuant(rgbPixels, { netsize: hasTransparenc ? 255 : 256, samplefac: 1 });
            nq.buildColorMap();
            rgbPixels = nq.getColorMap();
            if (hasTransparenc) {
                rgbPixels.push(0, 0, 0);
                frame.transparentColorIndex = 255;
            }
            frame.isGlobalPalette = false;
            frame.palette = rgbPixels;
        } else if ((colorMap.size  + (this.hasTransparenc ? 1: 0)) > 256) { //全局颜色板不够放,放到局部
            frame.isGlobalPalette = false;
            this.localColorMap.set(frame, localColorMap);
            frame.palette = rgbPixels;
            if (hasTransparenc) {
                frame.transparentColorIndex = rgbPixels.length / 3;
                rgbPixels.push(0, 0, 0);
            }
        } else {
            this.colorMap = colorMap;
            if (!frame.prevFrame) {
                this.palette = rgbPixels;
            } else {
                this.palette.push(...globalRgbPixels);
            }
            if (hasTransparenc && this.transparencIndex === undefined) {
                this.colorMap.set('a', this.colorMap.size);
                this.transparencIndex = this.palette.length / 3;
                this.palette.push(0, 0, 0);
            }
            frame.transparentColorIndex = this.transparencIndex;
            frame.isGlobalPalette = true;
            frame.palette = this.palette;
        }
    }
    
    /**
     *
     * 重新生成像素, 过滤重复的像素, 并裁剪成最小范围
     * @param {Frame[]} frames
     * @memberof GIFEncoder
     */
    generateImageDatas(frames: Frame[]) {
        const [firstFrame, ...otherFrams] = frames;
        let lastImageData = [...firstFrame.pixels];
        otherFrams.forEach((frame, i) => {
            let imgData: number[] = [];
            const { x, y, w } = frame;
            // let alphaList: number[] = [];
            let startNum = 0; // 表示从0开始连续的透明像素的数目
            let isDone = false;
            let endNum = 0; // 表示连续的且到最后的透明像素的数目
            let startOffset = 0;
            let maxStartOffset = frame.w; //左边空白像素
            let maxEndOffset = frame.w; // 右边空白像素

            for (let index = 0; index < frame.pixels.length; index += 4) {
                const offset = ((Math.floor((index / 4) / w) + y) * frame.width + x + (index / 4 % w)) * 4;
                const r1 = frame.pixels[index];
                const r2 = lastImageData[offset];
                const g1 = frame.pixels[index + 1];
                const g2 = lastImageData[offset + 1];
                const b1 = frame.pixels[index + 2];
                const b2 = lastImageData[offset + 2];
                const a = frame.pixels[index + 3];

                if (index / 4 % frame.w === 0) {
                    startOffset = 0;
                }

                if ((r1 === r2 && g1 === g2 && b1 === b2) || a === 0) {
                    imgData.push(0, 0, 0, 0);
                    if (!isDone) {
                        startNum += 1;
                    }
                    startOffset += 1;
                    endNum += 1;
                }  else {
                    imgData.push(r1, g1, b1, a);
                    lastImageData[offset] = r1;
                    lastImageData[offset + 1] = g1;
                    lastImageData[offset + 2] = b1;
                    lastImageData[offset + 3] = a;
                    if (!isDone) isDone = true;
                    maxStartOffset = startOffset < maxStartOffset ? startOffset : maxStartOffset;
                    endNum = 0;
                }
                if (maxEndOffset !== 0 && ((index / 4 + 1) % frame.w === 0)) {
                    const endOffset = endNum % frame.w;
                    maxEndOffset = endOffset < maxEndOffset ? endOffset : maxEndOffset;
                }
            }


            const top = Math.floor(startNum / frame.w);
            if (top) {
                imgData.splice(0, top * frame.w * 4);
                frame.y = top;
                frame.h -= top;
            }

            const bottom = Math.floor(endNum / frame.w);
            if (bottom) {
                imgData.splice(-bottom * frame.w * 4);
                frame.h -= bottom;
            }

            if (maxEndOffset || maxStartOffset) {
                imgData = imgData.filter((_, i) => {
                    const range = (Math.floor(i / 4) % frame.w);
                    if ((range < maxStartOffset || range >= (frame.w - maxEndOffset))) {
                        return false;
                    }
                    return true;
                })
                frame.x += maxStartOffset;
                frame.w -= (maxStartOffset + maxEndOffset);
            }

            frame.pixels = imgData;
        });
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

        while (this.palette!.length < (1 << this.colorDepth) * 3) {
            this.palette!.push(0, 0, 0);
        }

        let m = (this.palette.length ? 1 : 0) << 7; // globalColorTableFlag
        m += 0 << 4; // colorResolution
        m += 0 << 3; // sortFlag
        m += this.palette.length ? this.colorDepth - 1 : 0; // sizeOfGlobalColorTable
        this.addCode(m);
        this.addCode(0); // backgroundColorIndex
        this.addCode(255); // pixelAspectRatio
        if (this.palette.length) {
            this.addCodes(this.palette);
        }
    }

    findClosest(r: number, g: number, b: number, frame: Frame) {
        const colorMap = this.localColorMap.get(frame);
        const c = `${r},${g},${b}`;
        if (colorMap) {
            return colorMap.get(c)!;
        } else if (!frame.isGlobalPalette) {
            let minpos = 0;
            let mind = 256 * 256 * 256;

            for (let i = 0; i < frame.palette.length; i += 3) {
                const dr = r - frame.palette[i];
                const dg = g - frame.palette[i + 1];
                const db = b - frame.palette[i + 2];
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
        return this.colorMap.get(c)!;
    }

    async wirteFrames() {
        const frames = this.frames.filter(f => f.w && f.h);
        const codesArray = await Promise.all(frames.map(async (frame) => {
            let codes:number[] = [];
            // 1. Graphics Control Extension
            codes.push(0x21); // exc flag
            codes.push(0xf9); // al
            codes.push(4); // byte size
            let m = 0;
            m += 1 << 2; // sortFlag
            m += +frame.useInput << 1;
            m += frame.transparentColorIndex !== undefined ? 1 : 0;
            codes.push(m);
            codes.push(...this.numberToBytes(Math.floor(frame.delay / 10)));
            codes.push(frame.transparentColorIndex || 0);
            codes.push(0);

            // 2. image Descriptor
            codes.push(0x2c);

            codes.push(...this.numberToBytes(frame.x));
            codes.push(...this.numberToBytes(frame.y));
            codes.push(...this.numberToBytes(frame.w));
            codes.push(...this.numberToBytes(frame.h));
            m = 0;

            let colorDepth = this.colorDepth;
            if (!frame.isGlobalPalette) {
                const sizeOfColorTable = Math.ceil(Math.log2(frame.palette.length / 3)) - 1;
                colorDepth = sizeOfColorTable + 1;
                while (frame.palette!.length < (1 << colorDepth) * 3) {
                    frame.palette!.push(0, 0, 0);
                }
                m = (1 << 7) | sizeOfColorTable;
            }
            codes.push(m);
            if (!frame.isGlobalPalette) {
                codes.push(...frame.palette);
            }
            // Image Data
            codes.push(colorDepth);

            
            const indexs: number[] = [];
            const imageData = frame.pixels;

            for (let i = 0; i < imageData.length; i += 4) {
                if (imageData[i + 3] === 0) {
                    indexs.push(frame.transparentColorIndex!);
                } else {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    indexs.push(this.findClosest(r, g, b, frame));
                }
            }

            const data = await workPool.executeWork('encode', [frame.w, frame.h, colorDepth, indexs]);
            let len = data.length;
            while (len > 0) {
                codes.push(Math.min(len, 0xFF));
                codes = codes.concat(data.splice(0, 0xFF))
                len -= 255;
            }
            codes.push(0);
            return codes;
        }));
        codesArray.forEach(codes => this.addCodes(codes));
    }

    private writeApplicationExtension() {
        this.addCode(0x21);        
        this.addCode(255);
        this.addCode(11);
        this.addCodes(NETSCAPE2_0);
        this.addCode(3);
        this.addCode(1);
        this.addCode(0);
        this.addCode(0);
        this.addCode(0);
    }

    toBlob() {
        const array = new ArrayBuffer(this.codes.length);
        const view = new DataView(array);
        this.codes.forEach((v, i) => view.setUint8(i, v));
        return new Blob([view], {type: "image/png"});
    }
}