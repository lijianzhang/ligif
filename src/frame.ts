/*
 * @Author: lijianzhang
 * @Date: 2018-09-16 00:10:40
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-16 01:05:18
 */
interface IOpiton {
    methodType: number;
    useInputFlag: boolean;
    transparentColorIndex?: number;
    delay: number;
    transparentColorFlag: boolean;
}

export default class Frame {
    constructor(option: IOpiton) {
        this.methodType = option.methodType;
        this.useInputFlag = option.useInputFlag;
        this.delay = option.delay;
        this.transparentColorIndex = option.transparentColorIndex;
        this.transparentColorFlag = option.transparentColorFlag;
    }

    x = 0;
    y = 0;
    w = 0;
    h = 0;

    isLocalColor = false;

    isInterlace = false;

    isSort = false;

    sizeOfLocalColors = 0;

    globalColors?: string[];

    colors: string[] = [];

    methodType: number;

    useInputFlag: boolean;

    transparentColorIndex?: number;

    delay: number;

    transparentColorFlag: boolean;

    imgPoints: string[][] = []
    
    setImageData(data: number[]) {
        const colors = this.globalColors || this.colors;

        let i = 0;

        for (let x = 0; x < this.w; x++) {
            this.imgPoints[x] = [];
            for (let y = 0; y < this.h; y++) {
                this.imgPoints[x][y] =  colors[data[i]];
                i += 1;
            }
        }
    }
}