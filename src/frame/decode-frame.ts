/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:53:35
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-02 23:28:10
 */

import BaseFrame from './base-frame';
import workPool from '../work-pool';




export interface DecodeFrameDelegate {
    width: number;
    height: number;
    backgroundColor: [number, number, number] | null;
}

export default class DecodeFrame extends BaseFrame implements LiGif.IDecodeFrame {
    public preFrame?: DecodeFrame;

    public imgData = [];

    public displayType = 0;

    public ctx?: CanvasRenderingContext2D;

    public delegate: DecodeFrameDelegate;

    public async decodeToPixels() {
        const pixels = await workPool.executeWork('gif', {
            name: 'decodeToPixels',
            imgData: this.imgData,
            colorDepth: this.colorDepth,
            palette: this.palette,
            h: this.h,
            w: this.w,
            transparentColorIndex: this.transparentColorIndex,
            isInterlace: this.isInterlace
        });
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
        canvas.width = this.delegate.width;
        canvas.height = this.delegate.height;

        let imgData = this.ctx.getImageData(0, 0, this.w, this.h);

        this.pixels!.forEach((v, i) => (imgData.data[i] = v));
        this.ctx.putImageData(imgData, this.x, this.y, 0, 0, this.w, this.h);

        if (!this.preFrame && this.delegate.backgroundColor) {
            imgData = this.ctx.getImageData(0, 0, this.delegate.width, this.delegate.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i + 3] === 0) {
                    imgData.data[i] = this.delegate.backgroundColor[0];
                    imgData.data[i + 1] = this.delegate.backgroundColor[1];
                    imgData.data[i + 2] = this.delegate.backgroundColor[2];
                    imgData.data[i + 3] = 255;
                }
            }
        } else if (
            (this.displayType === 1 || this.displayType === 2) &&
            this.preFrame
        ) {
            if (!this.preFrame.ctx) this.preFrame.renderToCanvas(retry);
            imgData = this.ctx.getImageData(0, 0, this.delegate.width, this.delegate.height);
            const prevImageData = this.preFrame.ctx!.getImageData(
                0,
                0,
                this.delegate.width,
                this.delegate.height
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
