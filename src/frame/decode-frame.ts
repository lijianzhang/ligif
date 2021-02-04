/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:53:35
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2021-02-06 23:59:08
 */

import BaseFrame from './base-frame';
import workPool from '../work-pool';
import { Go } from '../go';





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
        this.pixels = await workPool.executeWork('gif', {
            name: 'decodeToPixels',
            imgData: this.imgData,
            colorDepth: this.colorDepth,
            palette: this.palette,
            h: this.h,
            w: this.w,
            transparentColorIndex: this.transparentColorIndex,
            isInterlace: this.isInterlace
        });
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

        if (this.preFrame) {
            if (!this.preFrame.ctx) this.preFrame.renderToCanvas(retry);
            const imgData = this.preFrame.ctx.getImageData(0, 0, this.delegate.width, this.delegate.height);
            this.ctx.putImageData(imgData, 0, 0)
        }

        let imgData = this.ctx.getImageData(this.x, this.y, this.w, this.h);

        for (let i = 0; i < imgData.data.length; i += 4) {
            if (this.pixels[i + 3] === 0) continue

            imgData.data[i] = this.pixels[i]
            imgData.data[i + 1] = this.pixels[i + 1]
            imgData.data[i + 2] = this.pixels[i + 2]
            imgData.data[i + 3] = this.pixels[i + 3]
        }

        this.ctx.putImageData(imgData, this.x, this.y)

        return this.ctx;
    }
}
