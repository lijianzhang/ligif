/*
 * @Author: lijianzhang
 * @Date: 2018-09-22 18:14:54
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-23 16:04:06
 */

import NeuQuant from './neuquant.js';
import workPool from './work';
import LzwEncoder from './lzw-encode';
type ImageCodeType = Uint8Array;

interface IImageInfo {
    x: number;
    y: number;
    w: number;
    h: number;
    delay: number;
    pixels: number[] | Uint8Array;
}

const NETSCAPE2_0 = 'NETSCAPE2.0'.split('').map(s => s.charCodeAt(0));

// [x, y, w, h, delay, 像素长度, ...像素, 是否有透明色, 颜色是否压缩过, 是否有透明性, 透明色位置, 是否使用全局颜色, ...颜色数据 ]

/**
 * 优化像素
 *
 * @param {ImageCodeType[]} imageDatas
 * @returns 内容格式为 [x, y, w, h, delay, 像素长度, ...像素]
 */
function optimizeImagePixels(imageDatas: ImageCodeType[]) {
    const [firstImageData, ...otherImageData] = imageDatas;
    const width = firstImageData[4] + (firstImageData[5] << 8);
    const lastPixels = Array.from(firstImageData.slice(10));

    const datas = otherImageData.map(imageData => {
        let x = imageData[0] + (imageData[1] << 8);
        let y = imageData[2] + (imageData[3] << 8);
        let w = imageData[4] + (imageData[5] << 8);
        let h = imageData[6] + (imageData[7] << 8);
        const delay = (imageData[8] + (imageData[9] << 8)) * 10;
        let pixels = imageData.slice(10);
        let imgData:number[] = [];

        // let alphaList: number[] = [];
        let startNum = 0; // 表示从0开始连续的透明像素的数目
        let isDone = false;
        let endNum = 0; // 表示连续的且到最后的透明像素的数目
        let startOffset = 0;
        let maxStartOffset = w; //左边空白像素
        let maxEndOffset = w; // 右边空白像素

        for (let index = 0; index < pixels.length; index += 4) {

            const offset = ((Math.floor(index / 4 / w) + y) * width + x + ((index / 4) % w)) * 4;
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
                imgData.push(0, 0, 0, 0);
                if (!isDone) {
                    startNum += 1;
                }
                startOffset += 1;
                endNum += 1;
            } else {
                imgData.push(r1, g1, b1, a);
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

        const top = Math.floor(startNum / w);
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

        imgData = imgData.slice(start, end);

        if (maxEndOffset || maxStartOffset) {
            imgData = imgData.filter((_, i) => {
                const range = Math.floor(i / 4) % w;
                if (range < maxStartOffset || range >= w - maxEndOffset) {
                    return false;
                }
                return true;
            });
            x += maxStartOffset;
            w -= maxStartOffset + maxEndOffset;
        }

        return transformFrameToImageData({
            x,
            y,
            w,
            h,
            pixels: imgData,
            delay,
        });
    });

    return [firstImageData].concat(datas);
}

/**
 *
 * 为性能考虑, 把frame的格式转为Uint8Array类型,
 * @param {IImageInfo} frame
 * @returns 内容格式为 [x, y, w, h, delay, ...像素]
 */
function transformFrameToImageData(frame: IImageInfo) {
    const { x, y, w, h, pixels } = frame;
    const delay = (frame.delay || 0) / 10;
    const imageData = new Uint8Array(pixels.length + 10);

    imageData.set([x & 255, x >> 8], 0);
    imageData.set([y & 255, y >> 8], 2);
    imageData.set([w & 255, w >> 8], 4);
    imageData.set([h & 255, h >> 8], 6);
    imageData.set([delay & 255, delay >> 8], 8);
    imageData.set(pixels, 10);
    return imageData;
}

/**
 * 填充调色板
 *
 * @param {number[]} palette
 * @returns
 */
function fillPalette(palette: number[]) {
    const colorSize = Math.ceil(Math.log2(palette.length / 3));
    const diff = (1 << colorSize) - palette.length / 3;
    const arr = new Array(diff * 3);
    arr.fill(0);
    return palette.concat(arr);
}

/**
 * 为了性能考虑, 将是否有透明性, 透明色位置 颜色数, 和是否使用全局颜色生产 Uint8Array 格式
 * 格式为 [x, y, w, h, delay, 像素长度, ...像素, 颜色是否压缩过, 是否有透明性, 透明色位置, 是否使用全局颜色, 颜色数 ]
 * 解析帧的图像: 配置帧图像的颜色和透明数据
 * TODO: 只用全局调色板不一定生成的gif体积就小, 尤其在颜色深度比较小的 gif 比较明显;
 *      因为颜色深度变大后, image data 占据的位数也会变大, 所以还要看像素使用的频率,
 * 1. 或者改为,首先生成全部局部颜色, 再做对比, 根据颜色使用频率生成全局颜色板 (感觉比较困难, 和影响性能)
 * 2. 或者改为,当颜色深度超过某一值得时候不再增加?
 * @memberof GIFEncoder
 */
function parseFramePalette(pixelInfos: ImageCodeType[]) {
    const firstPixelInfo = Array.from(pixelInfos[0]);
    let firstPalette = firstPixelInfo.slice(13, 13 + (firstPixelInfo[12] + 1) * 3);

    let hasTransparenc = !!firstPixelInfo[0];
    let transparencIndex: number | undefined;
    if (hasTransparenc) {
        transparencIndex = firstPalette.length / 3;
        firstPalette.push(0, 0, 0);
    }

    const otherPixelInfos = pixelInfos.slice(1);
    const imageDatas = otherPixelInfos.map(d => {
        const info = d;
        let data: number[] = Array.from(info.slice(0, 12));
        const palette =   Array.from(info.slice(13, 13 + (info[12] + 1) * 3));

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
                    firstPaletteCopy.splice(y, 3);
                    y -= 3;
                    hasSome = true;
                }
            }
            if (!hasSome) diffPallette.push(...Array.from(palette.slice(x, x + 3)));
        }

        const isLocalPalette = (firstPalette.length + diffPallette.length) / 3
                                + ((!!data[11] && !hasTransparenc) ? 1 : 0)
                                > 1 << Math.ceil(Math.log2(firstPalette.length / 3));
        if (data[11]) {
            // 添加透明色位置
            if (isLocalPalette) {
                const transparencIndex = palette.length / 3;
                data.push(transparencIndex);
                palette.push(0, 0, 0);
            } else {
                if (hasTransparenc) {
                    data.push(transparencIndex!);
                } else {
                    transparencIndex = firstPalette.length / 3;
                    firstPalette.push(0, 0, 0);
                    hasTransparenc = true;
                }
            }
        } else {
            data.push(0);
        }
        
        if (isLocalPalette) {
            // 添加是否使用全局颜色
            data.push(0);
            const p = fillPalette(Array.from(palette));

            data.push(p.length / 3 - 1);
            data = data.concat(p);
        } else {
            firstPalette.push(...diffPallette);
            data.push(1);
        }
        const imgdata = info.slice(13 + (info[12] + 1) * 3);

        const arr = new Uint8Array(data.length + imgdata.length);
        arr.set(data, 0);
        arr.set(imgdata, data.length);
        return arr;
    });

    let arr: number[] = Array.from(firstPixelInfo.slice(0, 11));
    arr.push(hasTransparenc ? 1 : 0, transparencIndex! || 0, 1);

    const palette = fillPalette(Array.from(firstPalette));

    arr.push(palette.length / 3 - 1);
    arr.push(...palette);
    arr = arr.concat(firstPixelInfo.slice(13 + (firstPixelInfo[12] + 1) * 3));
    return [Uint8Array.from(arr)].concat(imageDatas);
}

/** 压缩 */
async function encodeFramePixels(imageDatas: ImageCodeType[]) {
    const globalPalette = imageDatas[0].slice(15, 15 + (imageDatas[0][14] + 1) * 3);
    return await Promise.all(imageDatas.map(async imgData => {
        const baseData = Array.from(imgData.slice(0, 15 + (imgData[14] + 1) * 3));
        const isZip = imgData[10];
        const transparentColorIndex = imgData[12];
        const isGlobalPalette = imgData[13];
        const pixels = imgData.slice(15 + (imgData[14] + 1) * 3);
        
        const indexs: number[] = [];
        const palette = isGlobalPalette ? globalPalette : imgData.slice(15, 15 + (imgData[14] + 1) * 3);
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] === 0) {
                indexs.push(transparentColorIndex);
            } else {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                if (isZip) {
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
            imgData[4] + (imgData[5] << 8),
            imgData[6] + (imgData[7] << 8),
            Math.log2(palette.length / 3),
            arr],
            [arr.buffer]
        );

        // const encode = new LzwEncoder(imgData[4] + (imgData[5] << 8),
        // imgData[6] + (imgData[7] << 8),
        // Math.log2(palette.length / 3))
        // const codes = encode.encode(arr);
        const data = new Uint8Array(baseData.length + codes.length);
        data.set(baseData, 0);
        data.set(codes, baseData.length);
        return data;
        // const data =  baseData.concat(Array.from(codes));
    }));
}

/**
 * 对颜色数超过设置的颜色质量参数, 减少颜色质量
 *
 * @param {ImageCodeType} imgData
 * @param {number} [colorDepth=8]
 * @returns [x, y, w, h, delay, 颜色是否压缩过, 是否有透明色, 颜色数量, ...颜色数据, ...像素 ];
 *
 */
function decreasePalette(imgData: ImageCodeType, colorDepth: number = 8) {
    const colorMap: Map<string, boolean> = new Map();
    const pixels = imgData.slice(10);
    let colors: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];

        const c = a === 0 ? 'a' : `${r},${g},${b}`;
        if (!colorMap.has(c)) {
            colorMap.set(c, true);
            if (a !== 0) colors.push(r, g, b);
        }
    }

    if (colorMap.size > 1 << colorDepth) {
        const nq = new NeuQuant(colors, {
            netsize: colorMap.has('a') ? 255 : 256,
            samplefac: 1,
        });
        nq.buildColorMap();
        colors = nq.getColorMap();
    }

    let data = Array.from(imgData.slice(0, 10));
    data.push(colorMap.size > 1 << colorDepth ? 1 : 0);
    data.push(colorMap.get('a') ? 1 : 0);
    data.push(colors.length / 3 - 1);
    data = data.concat(colors).concat(Array.from(pixels));

    return Uint8Array.from(data);
}

function strTocode(str: string) {
    return str.split('').map(s => s.charCodeAt(0));
}

export default async function encoder(frames: IImageInfo[]) {

    let imgDatas = optimizeImagePixels(frames.map(f => transformFrameToImageData(f)));

    imgDatas = await encodeFramePixels(parseFramePalette(imgDatas.map(d => decreasePalette(d))));

    const codes: number[] = [];
    
    codes.push(...strTocode('GIF89a')); //头部识别信息

    // writeLogicalScreenDescriptor
    const firstImageData = imgDatas[0];

    codes.push(firstImageData[4], firstImageData[5]);  // w
    codes.push(firstImageData[6], firstImageData[7]); // h

    const palette = firstImageData.slice(15, 15 + (firstImageData[14] + 1) * 3);
    let m = 1 << 7; // globalColorTableFlag
    m += 0 << 4; // colorResolution
    m += 0 << 3; // sortFlag
    m += palette.length ? Math.ceil(Math.log2(palette.length / 3)) - 1 : 0; // sizeOfGlobalColorTable

    codes.push(m);
    codes.push(0); // backgroundColorIndex
    codes.push(255); // pixelAspectRatio
    codes.push(...Array.from(palette));


    // writeApplicationExtension
    codes.push(0x21);
    codes.push(255);
    codes.push(11);
    codes.push(...NETSCAPE2_0);
    codes.push(3);
    codes.push(1);
    codes.push(0);
    codes.push(0);
    codes.push(0);

    const globalPalette = firstImageData.slice(15, 15 + (firstImageData[14] + 1) * 3);

    imgDatas.filter(data => (data[4] + data[5] << 8) && (data[6] + data[6] << 8)).forEach((data, i) => {
        // 1. Graphics Control Extension
        codes.push(0x21); // exc flag
        codes.push(0xf9); // al
        codes.push(4); // byte size
        let m = 0;
        m += (data[11] ? 1 : 0) << 2
        m += 1 << 1; // sortFlag
        m += data[11]

        codes.push(m);
        if (i === 0) {
            codes.push(0, 0);
        } else {
            codes.push(data[8], data[9]);
        }
        codes.push(data[12]);
        codes.push(0);

        // 2. image Descriptor
        codes.push(0x2c);

        codes.push(data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7]); // add x, y, w, h

        m = 0;
        const isGlobalPalette = data[13];
        const palette = isGlobalPalette ? globalPalette : data.slice(15, 15 + (data[14] + 1) * 3);
        const sizeOfColorTable = Math.ceil(Math.log2(palette.length / 3)) - 1;
        const colorDepth = sizeOfColorTable + 1;
        if (!isGlobalPalette) {
            m = (1 << 7) | sizeOfColorTable;
        }
        codes.push(m);
        if (!isGlobalPalette) {
            codes.push(...Array.from(palette));
        }

        // image data
        codes.push(colorDepth);
        const c = Array.from(data.slice(15 + (data[14] + 1) * 3));
        let len = c.length;
        

        while (len > 0) {
            codes.push(Math.min(len, 0xff));
            codes.push(...c.splice(0, 0xff));
            len -= 255;
        }
        codes.push(0);
    });

    codes.push(0x3b);
    console.timeEnd('write frame');
    return codes;
}
