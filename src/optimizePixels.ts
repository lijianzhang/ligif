/*
 * @Author: lijianzhang
 * @Date: 2018-10-08 14:33:26
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2019-04-14 20:50:47
 */
import workPool from './work-pool';
import EncodeFrame from './frame/encode-Frame';

workPool.registerWork(
    'optimizePixels',
    (frames: EncodeFrame[], width: number, maxDiff: number = 30) => {
        const lastPixels = [];

        /**
         * 计算色差
         * from: https://blog.csdn.net/jaych/article/details/51137341?utm_source=cop
         */
        function colourDistance(
            rgb1: [number, number, number],
            rgb2: [number, number, number],
        ) {
            const rmean = (rgb1[0] + rgb2[0]) / 2;
            const r = rgb1[0] - rgb2[0];
            const g = rgb1[1] - rgb2[1];
            const b = rgb1[2] - rgb2[2];

            return Math.sqrt(
                (((rmean + 512) * r * r) >> 8) +
                    g * g * 4 +
                    (((767 - rmean) * b * b) >> 8),
            );
        }

        return frames.map(frame => {
            // tslint:disable-line
            const paletteMap = new Map();
            const palette: number[] = [];
            let x = frame.x;
            let y = frame.y;
            let w = frame.w;
            let h = frame.h;
            const pixels = frame.pixels;

            let newPixels: number[] = [];

            // let alphaList: number[] = [];
            let startNum = 0; // 表示从0开始连续的透明像素的数目
            let isDone = false;
            let endNum = 0; // 表示连续的且到最后的透明像素的数目
            let startOffset = 0;
            let maxStartOffset = w; // 左边空白像素
            let maxEndOffset = w; // 右边空白像素
            let transparencCount = 0;

            for (let index = 0; index < pixels.length; index += 4) {
                const offset =
                    (y + Math.floor(index / (w * 4))) * width * 4 +
                    ((index % (w * 4)) / 4 + x) * 4;
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

                const diff = colourDistance([r1, g1, b1], [r2, g2, b2]);

                if (diff < maxDiff || a === 0) {
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
                        palette.push(r1, g1, b1);
                        paletteMap.set(c, true);
                    }
                    newPixels.push(r1, g1, b1, a);
                    lastPixels[offset] = r1;
                    lastPixels[offset + 1] = g1;
                    lastPixels[offset + 2] = b1;
                    lastPixels[offset + 3] = a;
                    if (!isDone) isDone = true;
                    maxStartOffset =
                        startOffset < maxStartOffset
                            ? startOffset
                            : maxStartOffset;
                    endNum = 0;
                }
                if (maxEndOffset !== 0 && (index / 4 + 1) % w === 0) {
                    const endOffset = endNum % w;
                    maxEndOffset =
                        endOffset < maxEndOffset ? endOffset : maxEndOffset;
                }
            }
            transparencCount -= startNum + endNum;
            const top = Math.floor(startNum / w);
            let start = 0;
            let end = pixels.length;

            if (top) {
                start = top * w * 4;
                y += top;
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

            return {
                newPixels,
                x,
                y,
                w,
                h,
                palette,
                transparencCount,
                paletteMap,
            };
        });
    },
);
