/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:53:33
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-30 02:55:36
 */
export default class BaseFrame implements LiGif.IFrame {
    constructor(w: number, h: number, x: number = 0, y: number = 0) {
        this.w = w;
        this.h = h;
        this.x  = x;
        this.y = y;
    }

    public x: number;

    public y: number;

    public h: number;

    public w: number;

    public colorDepth = 8;

    public palette = [];

    public pixels = [];

    public isGlobalPalette = false;

    public isInterlace = false;

    public delay = 200;

    public transparentColorIndex?: number;
}
