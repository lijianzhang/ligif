/*
 * @Author: lijianzhang
 * @Date: 2018-09-16 00:10:40
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-16 20:38:02
 */
export interface IFrameOpiton {
    methodType: number;
    useInput: boolean;
    transparentColorIndex?: number;
    delay: number;
    transparentColorFlag: boolean;
}

export default class Frame {
    constructor(option: IFrameOpiton) {
        this.methodType = option.methodType;
        this.useInput = option.useInput;
        this.delay = option.delay;
        this.transparentColorIndex = option.transparentColorIndex || 0;
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

    colors: number[] = [];

    methodType: number;

    useInput: boolean;

    transparentColorIndex: number;

    delay: number;

    transparentColorFlag: boolean;

    imgPoints: number[] = [];

    
    setImageData(data: number[]) {
        this.imgPoints = data;
        // data.forEach((index) => {
        //     this.imgPoints.push(colors[index * 3]);
        //     this.imgPoints.push(colors[index * 3 + 1]);
        //     this.imgPoints.push(colors[index * 3 + 2]);
        //     this.imgPoints.push(this.transparentColorFlag && index === this.transparentColorIndex ? 0 : 255);
        // });
    }
}