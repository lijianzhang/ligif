/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:53:35
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-30 13:42:49
 */

import BaseFrame from './base-frame';
import '../lzw-decode';
import workPool from '../work-pool';
export default class DecodeFrame extends BaseFrame implements LiGif.IDecodeFrame {
    public preFrame?: DecodeFrame;

    public imgData = [];

    public displayType = 0;

    public ctx?: CanvasRenderingContext2D;

    /**
     * 第一帧宽度
     */
    get width() {
        if (this.preFrame) {
            return this.preFrame.width;
        }

        return this.w + this.x;
    }

    /**
     * 第一帧高度
     */
    get height() {
        if (this.preFrame) {
            return this.preFrame.height;
        }

        return this.h + this.y;
    }

    public async decodeToPixels() {
        const array = Uint8Array.from(this.imgData);
        const pixels = await workPool.executeWork('decode', [{ imgData: array,
            colorDepth: this.colorDepth,
            palette: this.palette,
            transparentColorIndex: this.transparentColorIndex,
            isInterlace: this.isInterlace }], [array.buffer]);
        this.pixels = pixels;
    }

    /**
     * 将图片数据渲染到canvas
     * 通过canvas转换为各种数据
     *
     * @param {boolean} [retry=false] 重新渲染
     * @returns
     * @memberof DecodeFrame
     */
    public renderToCanvas(retry = false) {
        if (this.ctx && !retry) return this.ctx;
        if (!this.pixels) throw new Error('缺少数据');
        const canvas = document.createElement('canvas');
        this.ctx = canvas.getContext('2d')!;
        canvas.width = this.width;
        canvas.height = this.height;

        let imgData = this.ctx.getImageData(0, 0, this.w, this.h);
        this.pixels!.forEach((v, i) => (imgData.data[i] = v));
        this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);

        if (
            (this.displayType === 1 || this.displayType === 2) &&
            this.preFrame
        ) {
            if (!this.preFrame.ctx) this.preFrame.renderToCanvas(retry);
            imgData = this.ctx.getImageData(0, 0, this.width, this.height);
            const prevImageData = this.preFrame.ctx!.getImageData(
                0,
                0,
                this.width,
                this.height
            );
            for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i + 3] === 0) {
                    imgData.data[i] = prevImageData.data[i];
                    imgData.data[i + 1] = prevImageData.data[i + 1];
                    imgData.data[i + 2] = prevImageData.data[i + 2];
                    imgData.data[i + 3] = prevImageData.data[i + 3];
                }
            }
            this.ctx.putImageData(imgData, 0, 0);
        }

        return this.ctx;
        // TODO: When displayType is equal to 3 or 4
    }
}
