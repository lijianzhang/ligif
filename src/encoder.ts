/*
 * @Author: lijianzhang
 * @Date: 2018-09-22 18:14:54
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-29 01:16:56
 */

import NeuQuant from './neuquant';
import './lzw-encode';
import workPool from './work';

interface IFrame {
    w: number;
    h: number;
    x?: number;
    y?: number;
    pixels: number[];
    delay?: number;
}

interface IFrameData {
    x: number;
    y: number;
    w: number;
    h: number;
    isZip: boolean;
    pixels: number[] | Uint8Array;
    delay: number;
    palette: number[];
    isGlobalPalette: boolean;
    transparentColorIndex?: number;
    hasTransparenc: boolean;
}

const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));


/**
 * 优化像素: 去掉相对于上一帧重复的像素
 *
 * @param {frames[]} imageDatas[]
 */
function optimizeImagePixels(frames: IFrameData[]) {
    const width = frames[0].w + frames[0].x;
    const height = frames[0].h + frames[0].y;
    const lastPixels = new Array(width * height * 4);

    const datas = frames.map(frame => {
        let paletteMap = new Map();
        let palette: number[] = [];
        let x = frame.x;
        let y = frame.y;
        let w = frame.w;
        let h = frame.h;
        let pixels = frame.pixels;
        let newPixels:number[] = [];

        // let alphaList: number[] = [];
        let startNum = 0; // 表示从0开始连续的透明像素的数目
        let isDone = false;
        let endNum = 0; // 表示连续的且到最后的透明像素的数目
        let startOffset = 0;
        let maxStartOffset = w; //左边空白像素
        let maxEndOffset = w; // 右边空白像素
        let isZip = false;
        let transparencCount = 0;


        for (let index = 0; index < pixels.length; index += 4) {

            const offset = ((y + Math.floor(index / (w * 4))) * width * 4) + ((index % (w * 4)) / 4 + x) * 4;
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

            if ((r1 === r2 && g1 === g2 && b1 === b2) || a === 0) {
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
                    palette.push(r1, g1,b1);
                    paletteMap.set(c, true);
                }
                newPixels.push(r1, g1, b1, a);
                lastPixels[offset] = r1;
                lastPixels[offset + 1] = g1;
                lastPixels[offset + 2] = b1;
                lastPixels[offset + 3] = a;
                if (!isDone) isDone = true;
                maxStartOffset = startOffset < maxStartOffset ? startOffset : maxStartOffset;
                endNum = 0;
            }
            if (maxEndOffset !== 0 && (index / 4 + 1) % w === 0) {
                const endOffset = endNum % w;
                maxEndOffset = endOffset < maxEndOffset ? endOffset : maxEndOffset;
            }
        }
        transparencCount -= (startNum + endNum);
        const top = Math.floor(startNum / w);;
        let start = 0;
        let end = pixels.length;

        if (top) {
            start = top * w * 4;
            y = top;
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

        if (paletteMap.size > 256) {
            const nq = new NeuQuant(palette, {
                netsize: transparencCount > 0 ? 255 : 256,
                samplefac: 1,
            });
            isZip = true;
            nq.buildColorMap();
            palette = Array.from(nq.getColorMap());
        }

        return {
            ...frame,
            x,
            y,
            w,
            isZip,
            hasTransparenc: transparencCount > 0,
            h,
            palette,
            pixels: newPixels,
        } as IFrameData;
    });
    return datas;
}


/**
 * 转换成压缩时需要的数据格式
 *
 * @param {IFrame} frame
 * @returns {IFrameData}
 */
function transformFrameToFrameData(frame: IFrame): IFrameData {
    const { w, h, pixels } = frame;
    const delay = Math.floor((frame.delay || 100) / 10);
    return {
        x: frame.x || 0,
        y: frame.y || 0,
        w,
        h,
        pixels,
        delay,
        palette: [],
        isGlobalPalette: false,
        isZip: false,
        hasTransparenc: false,
    }
}

/**
 * 填充调色板
 *
 * @param {number[]} palette
 * @returns
 */
function fillPalette(palette: number[]) {
    const colorSize = Math.max(Math.ceil(Math.log2(palette.length / 3)), 2);
    const diff = (1 << colorSize) - palette.length / 3;
    const arr = new Array(diff * 3);
    arr.fill(0);
    return palette.concat(arr);
}

/**
 * 解析帧的图像: 配置帧图像的颜色和透明数据
 * TODO: 只用全局调色板不一定生成的gif体积就小, 尤其在颜色深度比较小的 gif 比较明显;
 *      因为颜色深度变大后, image data 占据的位数也会变大, 所以还要看像素使用的频率,
 * 1. 或者改为,首先生成全部局部颜色, 再做对比, 根据颜色使用频率生成全局颜色板 (感觉比较困难, 和影响性能)
 * 2. 或者改为,当颜色深度超过某一值得时候不再增加?
 * @memberof GIFEncoder
 */
function parseFramePalette(frameDatas: IFrameData[]): IFrameData[] {
    const firstFrameData = frameDatas[0];
    let firstPalette = firstFrameData.palette;

    let hasTransparenc = firstFrameData.hasTransparenc;
    let transparencIndex: number | undefined;
    if (hasTransparenc) {
        transparencIndex = firstPalette.length / 3;
        firstPalette.push(0, 0, 0);
    }

    const otherPixelInfos = frameDatas.slice(1);
    const imageDatas = otherPixelInfos.map(d => {
        const info = { ...d };

        const palette =   info.palette;

        let firstPaletteCopy = firstPalette.slice();
        let diffPallette: number[] = [];
        for (let x = 0; x < palette.length; x += 3) {
            let hasSome = false;
            for (let y = 0; y < firstPaletteCopy.length; y += 3) {
                if (
                    palette[x] === firstPalette[y] &&
                    palette[x + 1] === firstPalette[y + 1] &&
                    palette[x + 2] === firstPalette[y + 2]
                ) {
                    hasSome = true;
                }
            }
            if (!hasSome) diffPallette.push(...palette.slice(x, x + 3));
        }


        const isLocalPalette = (firstPalette.length + diffPallette.length) / 3 + ((!!info.hasTransparenc && !hasTransparenc) ? 1 : 0) > 1 << Math.ceil(Math.log2(firstPalette.length / 3));

        if (info.hasTransparenc) {
            // 添加透明色位置
            if (isLocalPalette) {
                const transparencIndex = palette.length / 3;
                info.transparentColorIndex = transparencIndex;
                palette.push(0, 0, 0);
            } else {
                if (hasTransparenc) {
                    info.transparentColorIndex = transparencIndex;
                } else {
                    transparencIndex = firstPalette.length / 3;
                    info.transparentColorIndex = transparencIndex;
                    firstPalette.push(0, 0, 0);
                    hasTransparenc = true;
                }
            }
        }
        
        if (isLocalPalette) {
            // 添加是否使用全局颜色
            info.isGlobalPalette = false;
            const p = fillPalette(Array.from(palette));
            info.palette = p;
        } else {
            firstPalette.push(...diffPallette);
            info.isGlobalPalette = true;
        }

        return info;
    });

    const info = {...firstFrameData}
    info.hasTransparenc = hasTransparenc;
    info.transparentColorIndex = transparencIndex;
    info.isGlobalPalette = true;
    info.palette = fillPalette(firstPalette);

    return [info].concat(imageDatas);
}

/** 压缩 */
async function encodeFramePixels(frameDatas: IFrameData[]) {
    const globalPalette = frameDatas[0].palette;
    return await Promise.all(frameDatas.map(async (imgData) => {
        const isZip = imgData.isZip;
        const transparentColorIndex = imgData.transparentColorIndex;
        const isGlobalPalette = imgData.isGlobalPalette;
        const pixels = imgData.pixels;
        
        const indexs: number[] = [];
        const palette = isGlobalPalette ? globalPalette : imgData.palette;
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] === 0) {
                indexs.push(transparentColorIndex!);
            } else {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                if (isZip) { // from: https://github.com/unindented/neuquant-js/blob/master/src/helpers.js
                    let minpos = 0;
                    let mind = 256 * 256 * 256;
                    for (let i = 0; i < palette.length; i += 3) {
                        const dr = r - palette[i];
                        const dg = g - palette[i + 1];
                        const db = b - palette[i + 2];
                        const d = dr * dr + dg * dg + db * db;
                        const pos = (i / 3) | 0;

                        if (d < mind) {
                            mind = d;
                            minpos = pos;
                        }

                        i++;
                    }
                    indexs.push(minpos);
                } else {
                    for (let i = 0; i < palette.length; i += 3) {
                        if (palette[i] === r && palette[i + 1] === g && palette[i + 2] === b) {
                            indexs.push(i / 3);
                            break;
                        }
                    }
                }
            }
        }

        const arr = Uint8Array.from(indexs)
        const codes = await workPool.executeWork('encode', [
            imgData.w,
            imgData.h,
            Math.log2(palette.length / 3),
            arr],
            [arr.buffer]
        );

        imgData.pixels = codes;

        return imgData;
    }));
}

function strTocode(str: string) {
    return str.split('').map(s => s.charCodeAt(0));
}

export default async function encoder(frames: IFrame[], time: number = 0, cb?: (progress: number) => any) {
    let imgDatas = optimizeImagePixels(frames.map(f => transformFrameToFrameData(f)));
    (window as any).imgDatas = imgDatas;
    let progress = 33;
    if (cb) cb(progress);
    imgDatas =  parseFramePalette(imgDatas);
    imgDatas =  await encodeFramePixels(imgDatas);

    progress += 33;
    if (cb) cb(progress);
    const codes: number[] = [];
    
    codes.push(...strTocode('GIF89a')); //头部识别信息

    // writeLogicalScreenDescriptor
    const firstImageData = imgDatas[0];
    const w = firstImageData.w + firstImageData.x;
    const h = firstImageData.h + firstImageData.y;
    codes.push(w & 255, w >> 8);  // w
    codes.push(h & 255, h >> 8);  // w

    const globalPalette = firstImageData.palette;
    let m = 1 << 7; // globalColorTableFlag
    m += 0 << 4; // colorResolution
    m += 0 << 3; // sortFlag
    m += globalPalette.length ? Math.ceil(Math.log2(globalPalette.length / 3)) - 1 : 0; // sizeOfGlobalColorTable

    codes.push(m);
    codes.push(0); // backgroundColorIndex
    codes.push(255); // pixelAspectRatio
    codes.push(...globalPalette);
    if (time !== 1) {
        // writeApplicationExtension
        codes.push(0x21);
        codes.push(255);
        codes.push(11);
        codes.push(...NETSCAPE2_0);
        codes.push(3);
        codes.push(1);
        codes.push((time > 1 ? time - 1 : 0) & 255);
        codes.push((time > 1 ? time - 1 : 0) >> 8);
        codes.push(0);
    }

    imgDatas.filter(data => data.w && data.h).forEach((data) => {
        // 1. Graphics Control Extension
        codes.push(0x21); // exc flag
        codes.push(0xf9); // al
        codes.push(4); // byte size
        let m = 0;
        let displayType = 0;


        if (data.x || data.y || data.hasTransparenc) {
            displayType = 1;
        }

        m += displayType << 2
        m += 1 << 1; // sortFlag
        m += data.hasTransparenc ? 1 : 0;

        codes.push(m);
        codes.push(data.delay & 255, data.delay >> 8);
        codes.push(data.transparentColorIndex || 0);
        codes.push(0);

        // 2. image Descriptor
        codes.push(0x2c);

        codes.push(data.x & 255, data.x >> 8); // add x, y, w, h
        codes.push(data.y & 255, data.y >> 8); // add x, y, w, h
        codes.push(data.w & 255, data.w >> 8); // add x, y, w, h
        codes.push(data.h & 255, data.h >> 8); // add x, y, w, h

        m = 0;
        const isGlobalPalette = data.isGlobalPalette;
        const palette = isGlobalPalette ? globalPalette : data.palette;
        const sizeOfColorTable = Math.ceil(Math.log2(palette.length / 3)) - 1;
        const colorDepth = sizeOfColorTable + 1;
        if (!isGlobalPalette) {
            m = (1 << 7) | sizeOfColorTable;
        }
        codes.push(m);
        if (!isGlobalPalette) {
            codes.push(...palette);
        }

        // image data
        codes.push(colorDepth);
        const c = Array.from(data.pixels);
        let len = c.length;
        
        while (len > 0) {
            codes.push(Math.min(len, 0xff));
            codes.push(...c.splice(0, 0xff));
            len -= 255;
        }
        codes.push(0);
        progress += 1 / imgDatas.length * 33;
        if (cb) cb(progress);
    });

    codes.push(0x3b);
    if (cb) cb(100);
    return codes;
}
